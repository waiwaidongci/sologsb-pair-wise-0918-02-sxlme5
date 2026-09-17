import type { BatchStatus } from "../types";
import { STATUS_LABEL } from "../types";

const CLASS: Record<BatchStatus, string> = {
  pending: "pill-pending",
  pass: "pill-pass",
  redye: "pill-redye",
};

export function StatusPill({ status }: { status: BatchStatus }) {
  return <span className={"pill " + CLASS[status]}>{STATUS_LABEL[status]}</span>;
}
