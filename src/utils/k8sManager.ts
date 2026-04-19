import { exec } from 'child_process';
import * as vscode from 'vscode';

export class K8sManager {
    static async ensurePortForward(podSelector: string, localPort: number, namespace?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const nsFlag = namespace ? `-n ${namespace}` : '';
            const command = `kubectl get pods ${nsFlag} -l ${podSelector} -o jsonpath="{.items[0].metadata.name}"`;
            
            exec(command, (err: any, stdout: any) => {
                if (err || !stdout.trim()) {
                    return reject(new Error(`Could not find pod with selector: ${podSelector} ${namespace ? `in namespace: ${namespace}` : ''}`));
                }
                
                const podName = stdout.trim();
                vscode.window.showInformationMessage(`VisualVS: Found Memgraph pod ${podName}. Starting port-forward...`);
                
                // Start port-forward in background
                const pfCommand = `kubectl port-forward ${podName} ${localPort}:7687 ${nsFlag}`;
                const pfProcess = exec(pfCommand);
                
                pfProcess.stdout?.on('data', (data: any) => {
                    if (data.includes('Forwarding from')) {
                        vscode.window.showInformationMessage(`VisualVS: Memgraph connection established on port ${localPort}`);
                        resolve();
                    }
                });
                
                pfProcess.stderr?.on('data', (data: any) => {
                    if (data.includes('error')) {
                        reject(new Error(`Port-forward failed: ${data}`));
                    }
                });

                // Auto-kill on extension deactivate (handled via disposables in real app)
            });
        });
    }
}
