import { useSettingsPageStatesStore } from "@/services/store";
import { useLogger } from "@/helpers/use-logger";
import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

export default function usePotServer() {
    const setIsRunningPotServer = useSettingsPageStatesStore(state => state.setIsRunningPotServer);
    const setIsStartingPotServer = useSettingsPageStatesStore(state => state.setIsStartingPotServer);
    const potServerPid = useSettingsPageStatesStore(state => state.potServerPid);
    const setPotServerPid = useSettingsPageStatesStore(state => state.setPotServerPid);
    const potServerPort = useSettingsPageStatesStore(state => state.settings.pot_server_port);
    const LOG = useLogger();

    const stripAnsiAndLogPrefix = (line: string): string => {
        const stripped = line.replace(/\x1b\[\d+m/g, '');
        return stripped.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+\w+\s+[\w:]+:\s*/, '');
    };

    const startPotServer = async (port?: number) => {
        const runCommand = Command.sidecar('binaries/neodlp-pot', [
            'server',
            '--port',
            port ? port.toString() : potServerPort.toString(),
        ]);

        try {
            setIsStartingPotServer(true);
            LOG.info("NEODLP POT-SERVER", `Starting POT Server on port: ${port ?? potServerPort}`);

            runCommand.on("close", (data) => {
                if (data.code === 0) {
                    LOG.info("NEODLP POT-SERVER", `POT Server process exited with code: ${data.code}`);
                } else {
                    LOG.error("NEODLP POT-SERVER", `POT Server process exited with code: ${data.code} (ignore if you manually stopped the server)`);
                }
                setIsRunningPotServer(false);
                setPotServerPid(null);
            });

            runCommand.on("error", (error) => {
                LOG.error("NEODLP POT-SERVER", `Error running POT Server: ${error}`);
                setIsRunningPotServer(false);
                setPotServerPid(null);
            });

            runCommand.stdout.on("data", (line) => {
                const cleanedLine = stripAnsiAndLogPrefix(line).trim();
                if (cleanedLine !== '') LOG.info("NEODLP POT-SERVER", cleanedLine);
                if (cleanedLine.startsWith("POT server")) {
                    setIsRunningPotServer(true);
                }
            });

            runCommand.stderr.on("data", (line) => {
                const cleanedLine = stripAnsiAndLogPrefix(line).trim();
                if (cleanedLine !== '') LOG.error("NEODLP POT-SERVER", cleanedLine);
            });

            const child = await runCommand.spawn();
            setPotServerPid(child.pid);
        } catch (error) {
            LOG.error("NEODLP POT-SERVER", `Error starting POT Server: ${error}`);
        } finally {
            setIsStartingPotServer(false);
        }
    }

    const stopPotServer = async () => {
        if (!potServerPid) {
            LOG.warning("NEODLP POT-SERVER", "No POT Server process found to stop.");
            return;
        }

        try {
            LOG.info("NEODLP POT-SERVER", `Stopping POT Server with PID: ${potServerPid}`);
            await invoke('kill_all_process', { pid: potServerPid });
            LOG.info("NEODLP POT-SERVER", "POT Server stopped successfully.");
            setIsRunningPotServer(false);
            setPotServerPid(null);
        } catch (error) {
            LOG.error("NEODLP POT-SERVER", `Error stopping POT Server: ${error}`);
        }
    }

    return { startPotServer, stopPotServer};
}
