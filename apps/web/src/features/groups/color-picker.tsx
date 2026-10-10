import { GROUP_COLORS, type GroupColor } from "@bankroll/contracts";
import { groupColorClass } from "@/components/ui";

const colorNames: Record<GroupColor, string> = {
  brass: "Gold",
  lagoon: "Green",
  navy: "Navy",
  rose: "Pink",
  violet: "Purple",
};

export function GroupColorPicker({ value, onChange }: { value: GroupColor; onChange: (color: GroupColor) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption leading-caption font-bold text-ink-soft">Group colour</span>
      <div role="radiogroup" aria-label="Group colour" className="flex gap-2">
        {GROUP_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={colorNames[color]}
            onClick={() => onChange(color)}
            className={`size-[26px] shrink-0 rounded-pill ${groupColorClass[color]} ${
              value === color ? "shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#206B52]" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
