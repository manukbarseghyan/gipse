"use client";

import type { ComponentProps } from "react";

/** A <select> that submits its form on change; plain GET form fallback without JS. */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
