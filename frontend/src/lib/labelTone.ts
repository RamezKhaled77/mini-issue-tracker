import type { BadgeTone } from "../components/Badge.js";
import type { LabelColor } from "@mini-issue-tracker/shared";

export function labelTone(color: LabelColor): BadgeTone {
  switch (color) {
    case "violet":
    case "magenta":
    case "indigo":
    case "olive":
    case "sand":
    case "plum":
      return `label-${color}`;
    default:
      return "neutral";
  }
}