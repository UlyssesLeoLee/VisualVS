/**
 * @module k8sManager
 * @description Kubernetes operations for Memgraph pod lifecycle management.
 *   Handles deployment, pod readiness polling, and port-forward establishment.
 *
 * @cypher-manifest
 * // ── Module node ───────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'k8sManager', path: 'src/utils/k8sManager.ts', layer: 'util'})
 * // ── Class & method nodes ───────────────────────────────────────────────────
 * MERGE (:Class  {name: 'K8sManager',        module: 'k8sManager'})
 * MERGE (:Method {name: 'deployMemgraph',    class: 'K8sManager', static: true,  access: 'public'})
 * MERGE (:Method {name: 'ensurePortForward', class: 'K8sManager', static: true,  access: 'public'})
 * MERGE (:Method {name: 'startPortForward',  class: 'K8sManager', static: true,  access: 'private'})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'k8sManager'})-[:CONTAINS]->(:Class  {name: 'K8sManager'})
 * MERGE (:Class  {name: 'K8sManager'}) -[:CONTAINS]->(:Method {name: 'deployMemgraph'})
 * MERGE (:Class  {name: 'K8sManager'}) -[:CONTAINS]->(:Method {name: 'ensurePortForward'})
 * MERGE (:Class  {name: 'K8sManager'}) -[:CONTAINS]->(:Method {name: 'startPortForward'})
 * // ── Internal call graph ────────────────────────────────────────────────────
 * MERGE (:Method {name: 'ensurePortForward'})-[:CALLS]->(:Method {name: 'deployMemgraph'})
 * MERGE (:Method {name: 'ensurePortForward'})-[:CALLS]->(:Method {name: 'startPortForward'})
 * // ── External dependencies ───────────────────────────────────────────────────
 * MERGE (:Class  {name: 'K8sManager'})-[:USES]->(:Lib {name: 'child_process', syscall: 'exec'})
 * MERGE (:Method {name: 'deployMemgraph'})-[:CALLS]->(:Cmd {name: 'kubectl apply'})
 * MERGE (:Method {name: 'ensurePortForward'})-[:CALLS]->(:Cmd {name: 'kubectl get pods'})
 * MERGE (:Method {name: 'startPortForward'})-[:CALLS]->(:Cmd {name: 'kubectl port-forward'})
 * // ── Inbound callers ───────────────────────────────────────────────────────
 * MERGE (:Class {name: 'K8sConnPlugin'})-[:CALLS]->(:Method {name: 'ensurePortForward'})
 * MERGE (:Function {name: 'activate'})-[:CALLS]->(:Method {name: 'deployMemgraph'})
 */

import { exec } from 'child_process';
import * as vscode from 'vscode';

export class K8sManager {
    static async deployMemgraph(namespace: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: visualvs-memgraph
  labels:
    app: memgraph
spec:
  replicas: 1
  selector:
    matchLabels:
      app: memgraph
  template:
    metadata:
      labels:
        app: memgraph
    spec:
      containers:
      - name: memgraph
        image: memgraph/memgraph:latest
        ports:
        - containerPort: 7687
---
apiVersion: v1
kind: Service
metadata:
  name: visualvs-memgraph
spec:
  selector:
    app: memgraph
  ports:
  - port: 7687
    name: bolt
`;
            const nsFlag = namespace && namespace !== 'default' ? `-n ${namespace}` : '';
            const child = exec(`kubectl apply -f - ${nsFlag}`, (err, stdout, stderr) => {
                if (err) return reject(new Error(stderr || err.message));
                resolve();
            });
            child.stdin?.write(yaml);
            child.stdin?.end();
        });
    }

    static async ensurePortForward(podSelector: string, localPort: number, namespace?: string, autoDeploy: boolean = true): Promise<void> {
        return new Promise((resolve, reject) => {
            const nsFlag = namespace ? `-n ${namespace}` : '';
            const command = `kubectl get pods ${nsFlag} -l ${podSelector} --field-selector=status.phase=Running -o jsonpath="{.items[0].metadata.name}"`;
            
            exec(command, async (err: any, stdout: any) => {
                if (err || !stdout.trim()) {
                    if (autoDeploy) {
                        try {
                            vscode.window.showInformationMessage(`VisualVS: Memgraph not found. Auto-deploying to K8s...`);
                            await this.deployMemgraph(namespace || 'default');
                            
                            // Poll until Running
                            let retries = 20;
                            const checkPod = setInterval(() => {
                                exec(command, (err2: any, stdout2: any) => {
                                    if (!err2 && stdout2.trim()) {
                                        clearInterval(checkPod);
                                        this.startPortForward(stdout2.trim(), localPort, nsFlag).then(resolve).catch(reject);
                                    } else {
                                        retries--;
                                        if (retries <= 0) {
                                            clearInterval(checkPod);
                                            reject(new Error("Timeout waiting for deployed Memgraph pod to become Running."));
                                        }
                                    }
                                });
                            }, 3000);
                            return;
                        } catch (depErr: any) {
                            return reject(new Error(`Auto-deploy failed: ${depErr.message}`));
                        }
                    }
                    const nsString = namespace ? " in namespace: " + namespace : "";
                    return reject(new Error(`Could not find pod with selector: ${podSelector}${nsString}`));
                }
                
                this.startPortForward(stdout.trim(), localPort, nsFlag).then(resolve).catch(reject);
            });
        });
    }

    private static startPortForward(podName: string, localPort: number, nsFlag: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Start port-forward in background
            const pfCommand = `kubectl port-forward ${podName} ${localPort}:7687 ${nsFlag}`;
            const pfProcess = exec(pfCommand);
            
            pfProcess.stdout?.on('data', (data: any) => {
                if (data.includes('Forwarding from')) {
                    resolve();
                }
            });
            
            pfProcess.stderr?.on('data', (data: any) => {
                if (data.includes('error')) {
                    reject(new Error(`Port-forward failed: ${data}`));
                }
            });
        });
    }
}
