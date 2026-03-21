import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Lead {
  name: string;
  company?: string;
  title?: string;
  expertiseTags?: string[];
}

interface LeadSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  maxSelectable: number;
  onConfirm: (selectedIndices: number[]) => void;
}

export default function LeadSelectionDialog({
  open,
  onOpenChange,
  leads,
  maxSelectable,
  onConfirm,
}: LeadSelectionDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        if (next.size < maxSelectable) next.add(idx);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Table Leads</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            You have <span className="font-semibold text-foreground">{leads.length}</span> table leads
            designated but only <span className="font-semibold text-foreground">{maxSelectable}</span> tables.
            Please choose which {maxSelectable} to assign.
          </p>
        </DialogHeader>

        <div className="space-y-1 max-h-[300px] overflow-auto">
          {leads.map((lead, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                selected.has(idx) ? "bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={selected.has(idx)}
                onCheckedChange={() => toggle(idx)}
                disabled={!selected.has(idx) && selected.size >= maxSelectable}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lead.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[lead.title, lead.company].filter(Boolean).join(" · ")}
                </p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Badge variant="secondary">
              {selected.size} / {maxSelectable} selected
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={selected.size !== maxSelectable}>
                Confirm
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
