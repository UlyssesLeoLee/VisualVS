import { exec } from 'child_process';
import * as vscode from 'vscode';

export class K8sManager {
    static async ensurePortForward(podSelector: string, localPort: number): Promise<void> {
        return new Promise((resolve, reject) => {
            // 1. Check if the port is already in use (assuming it might be our previous forward)
            // For simplicity, we'll try to find the pod and start port-forwarding.
            // In a production app, we'd handle process persistence better.
            
            const command = `kubectl get pods -l ${podSelector} -o jsonpath="{.items[0].metadata.name}"`;
            
            exec(command, (err: any, stdout: any) => {
                if (err || !stdout.trim()) {
                    return reject(new Error(`Could not find pod with selector: ${podSelector}`));
                }
                
                const podName = stdout.trim();
                vscode.window.showInformationMessage(`VisualVS: Found Memgraph pod ${podName}. Starting port-forward...`);
                
                // Start port-forward in background
                const pfProcess = exec(`kubectl port-forward ${podName} ${localPort}:7687`);
                
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
