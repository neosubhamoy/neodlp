export interface Log {
    timestamp: number;
    level: 'info' | 'warning' | 'error' | 'debug';
    context: string;
    message: string;
}