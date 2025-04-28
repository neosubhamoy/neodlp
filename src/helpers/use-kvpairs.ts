import { useSaveKvPair } from "@/services/mutations";
import { useKvPairsStatesStore } from "@/services/store";
import { useQueryClient } from "@tanstack/react-query";

export function useKvPairs() {
  const queryClient = useQueryClient();
  const setKvPairsKey = useKvPairsStatesStore(state => state.setKvPairsKey);
  const kvPairSaver = useSaveKvPair();

  const saveKvPair = (key: string, value: unknown) => {
    kvPairSaver.mutate({ key, value }, {
      onSuccess: (data) => {
        setKvPairsKey(key, value);
        console.log("KvPairs key saved successfully:", data);
        queryClient.invalidateQueries({ queryKey: ["kv-pairs"] });
      },
      onError: (error) => {
        console.error(`Error saving kvpairs key: ${key}:`, error);
        queryClient.invalidateQueries({ queryKey: ["kv-pairs"] });
      }
    });
  };

  return { saveKvPair };
}