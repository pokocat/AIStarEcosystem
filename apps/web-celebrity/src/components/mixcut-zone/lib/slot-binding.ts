import type { FillStrategy, SlotBinding, TemplateSlot } from "../types";

type FillLikeSlot = Pick<TemplateSlot, "fill_strategy" | "layer_type">;

export function effectiveFillForSlot(slot: FillLikeSlot): FillStrategy {
  if (
    slot.layer_type === "text" &&
    (slot.fill_strategy === "user_upload" || slot.fill_strategy === "library_select")
  ) {
    return "user_input";
  }
  if (slot.layer_type !== "text" && slot.fill_strategy === "user_input") {
    return "user_upload";
  }
  return slot.fill_strategy;
}

export function isSlotBindingFilled(slot: FillLikeSlot, binding?: SlotBinding): boolean {
  const fill = effectiveFillForSlot(slot);

  if (fill === "fixed" || fill === "api_generated") {
    return true;
  }
  if (!binding) return false;

  switch (fill) {
    case "user_input":
      return binding.source === "input" && binding.text.trim().length > 0;
    case "picgen_text":
      return binding.source === "picgen" && binding.title.trim().length > 0;
    case "library_select":
      return binding.source === "library" && binding.asset_id.trim().length > 0;
    case "user_upload":
      return (
        (binding.source === "upload" && binding.file_url.trim().length > 0) ||
        (binding.source === "library" && binding.asset_id.trim().length > 0)
      );
    case "variable_binding":
      return (
        (binding.source === "input" && binding.text.trim().length > 0) ||
        (binding.source === "picgen" && binding.title.trim().length > 0) ||
        (binding.source === "upload" && binding.file_url.trim().length > 0) ||
        (binding.source === "library" && binding.asset_id.trim().length > 0) ||
        binding.source === "fixed"
      );
    default:
      return false;
  }
}
