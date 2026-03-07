interface CsvPreviewTableProps {
  data: Record<string, string>[];
  mapping: Record<string, string>;
}

export default function CsvPreviewTable({ data, mapping }: CsvPreviewTableProps) {
  const displayFields = Object.entries(mapping)
    .filter(([, v]) => v)
    .slice(0, 6);

  const previewRows = data.slice(0, 10);

  if (displayFields.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              {displayFields.map(([canonical]) => (
                <th key={canonical} className="text-left px-3 py-2 font-medium text-xs">
                  {canonical.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-t">
                {displayFields.map(([canonical, csvHeader]) => (
                  <td key={canonical} className="px-3 py-2 text-xs truncate max-w-[200px]">
                    {row[csvHeader] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-3 py-2 bg-muted text-xs text-muted-foreground text-center">
          Showing 10 of {data.length} records
        </div>
      )}
    </div>
  );
}
