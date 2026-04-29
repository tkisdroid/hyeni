// Hardware back-button (Android) handler stack.
//
// React screens call useBackHandler(fn) to register a step-back behavior
// while they are mounted. fn returns truthy when it consumed the back press,
// falsy to let the caller fall through to the App-level cascade.
//
// The App-level @capacitor/app backButton listener calls dispatchBack() first.

import { useEffect, useRef } from "react";

const stack = [];

export function pushBackHandler(fn) {
  stack.push(fn);
}

export function popBackHandler(fn) {
  const i = stack.lastIndexOf(fn);
  if (i >= 0) stack.splice(i, 1);
}

export function dispatchBack() {
  for (let i = stack.length - 1; i >= 0; i--) {
    try {
      if (stack[i]()) return true;
    } catch (err) {
      console.error("[backHandler] handler threw:", err);
    }
  }
  return false;
}

export function useBackHandler(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const wrapped = () => ref.current?.();
    pushBackHandler(wrapped);
    return () => popBackHandler(wrapped);
  }, []);
}
