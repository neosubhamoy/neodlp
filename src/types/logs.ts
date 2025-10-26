export interface Log {
    timestamp: number;
    level: 'info' | 'warning' | 'error' | 'debug' | 'progress';
    context: string;
    message: string;
}
