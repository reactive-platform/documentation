import {useEffect, useRef} from "react";

class PromiseState {
    cancelled: boolean = false;
    running: boolean = false;
}

export interface RequestProps {
    input: RequestInfo | URL,
    init?: RequestInit,
    onStart?: () => void,
    onFinish?: (x: Response) => Promise<void>,
    onFail?: (x: string) => void,
    dependencies?: any[]
}

export function useRequest({input, init, onStart, onFinish, onFail, dependencies = []}: RequestProps) {
    const stateRef = useRef(new PromiseState());

    useEffect(() => {
        async function loadAsync(state: PromiseState) {
            state.running = true;
            if (onStart) {
                onStart();
            }

            const res = await fetch(input, init);
            console.log(res);

            if (state.cancelled) {
                return;
            }

            if (res.ok) {
                if (onFinish) {
                    await onFinish(res);
                }
            } else {
                if (onFail) {
                    onFail(res.statusText);
                }
            }

            state.running = false;
        }

        if (stateRef.current.running) {
            stateRef.current.cancelled = true;
            stateRef.current = new PromiseState();
        }

        // noinspection JSIgnoredPromiseFromCall
        loadAsync(stateRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
}
