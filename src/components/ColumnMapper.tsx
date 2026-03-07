import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ColumnMapperProps {
  csvHeaders: string[];
  canonicalFields: string[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  onConfirm: () => void;
}

export default function ColumnMapper({ csvHeaders, canonicalFields, mapping, onMappingChange, onConfirm }: ColumnMapperProps) {
  const updateMapping = (canonical: string, csvHeader: string) => {
    onMappingChange({ ...mapping, [canonical]: csvHeader === "__none__" ? "" : csvHeader });
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-sm">Column Mapping</h3>
          <p className="text-xs text-muted-foreground">{mappedCount}/{canonicalFields.length} fields mapped</p>
        </div>
        <Button size="sm" onClick={onConfirm}>Confirm Mapping</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 max-h-80 overflow-auto">
        {canonicalFields.map((field) => (
          <div key={field} className="flex items-center gap-2">
            <Label className="w-40 text-xs truncate shrink-0">{field.replace(/_/g, " ")}</Label>
            <Select value={mapping[field] || "__none__"} onValueChange={(v) => updateMapping(field, v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Skip —</SelectItem>
                {csvHeaders.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
