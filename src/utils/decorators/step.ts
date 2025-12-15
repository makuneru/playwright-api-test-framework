import { test } from "@playwright/test";

function formatTitle(title: string, args: unknown[]): string {
  return title.replace(/\{(\d+)\}/g, (_match, index) => {
    const arg = args[parseInt(index, 10)];
    if (typeof arg === "object" && arg !== null) {
      return JSON.stringify(arg);
    }
    return String(arg);
  });
}

export function step(title: string) {
  return function actualDecorator<Func extends (...args: any[]) => any>(
    target: Func
  ) {
    return async function replacementMethod(this: Func, ...args: unknown[]) {
      const formattedTitle = formatTitle(title, args);
      try {
        return await test.step(formattedTitle, async () =>
          target.call(this, ...args)
        );
      } catch (error) {
        if (
          (error as Error).message.includes(
            "test.step() can only be called from a test"
          )
        ) {
          return target.call(this, ...args);
        } else {
          throw error;
        }
      }
    };
  };
}

