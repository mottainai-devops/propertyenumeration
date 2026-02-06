import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
  Info,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

type ImportRow = {
  rowNumber: number;
  formId: string;
  supervisorId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerType: string;
  socioClass?: string;
  binType: string;
  wheelieBinType?: string;
  binQuantity: number;
  buildingId: string;
  latitude?: string;
  longitude?: string;
  pickUpDate: string;
  firstPhoto: string;
  secondPhoto: string;
  incidentReport?: string;
  companyId?: number;
  companyName?: string;
  lotCode?: string;
  lotName?: string;
  userId: number;
  errors?: string[];
};

export default function CustomerImport() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPickupBulk = trpc.pickups.createBulk.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      toast.success(`Import complete: ${result.success} records imported successfully`);
      if (result.failed > 0) {
        toast.error(`${result.failed} records failed to import`);
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (
      !selectedFile.name.endsWith(".csv") &&
      !selectedFile.name.endsWith(".xlsx") &&
      !selectedFile.name.endsWith(".xls")
    ) {
      toast.error("Please select a CSV or Excel file");
      return;
    }

    setFile(selectedFile);
    setParsedData([]);
    setImportResult(null);
  };

  const parseCSV = (text: string): ImportRow[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      toast.error("CSV file is empty or has no data rows");
      return [];
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: ImportRow = {
        rowNumber: i + 1,
        formId: values[headers.indexOf("formid")] || `IMPORT-${Date.now()}-${i}`,
        supervisorId: values[headers.indexOf("supervisorid")] || "",
        customerName: values[headers.indexOf("customername")],
        customerPhone: values[headers.indexOf("customerphone")],
        customerEmail: values[headers.indexOf("customeremail")],
        customerAddress: values[headers.indexOf("customeraddress")],
        customerType: values[headers.indexOf("customertype")] || "residential",
        socioClass: values[headers.indexOf("socioclass")],
        binType: values[headers.indexOf("bintype")] || "",
        wheelieBinType: values[headers.indexOf("wheeliebintype")],
        binQuantity: parseInt(values[headers.indexOf("binquantity")]) || 1,
        buildingId: values[headers.indexOf("buildingid")] || "",
        latitude: values[headers.indexOf("latitude")] || undefined,
        longitude: values[headers.indexOf("longitude")] || undefined,
        pickUpDate: values[headers.indexOf("pickupdate")] || new Date().toLocaleDateString(),
        firstPhoto: values[headers.indexOf("firstphoto")] || "",
        secondPhoto: values[headers.indexOf("secondphoto")] || "",
        incidentReport: values[headers.indexOf("incidentreport")],
        companyId: values[headers.indexOf("companyid")] ? parseInt(values[headers.indexOf("companyid")]) : undefined,
        companyName: values[headers.indexOf("companyname")],
        lotCode: values[headers.indexOf("lotcode")],
        lotName: values[headers.indexOf("lotname")],
        userId: values[headers.indexOf("userid")] ? parseInt(values[headers.indexOf("userid")]) : 0,
        errors: [],
      };

      // Validate required fields
      if (!row.supervisorId) row.errors?.push("Missing supervisorId");
      if (!row.customerType) row.errors?.push("Missing customerType");
      if (!row.binType) row.errors?.push("Missing binType");
      if (!row.buildingId) row.errors?.push("Missing buildingId");
      if (!row.firstPhoto) row.errors?.push("Missing firstPhoto");
      if (!row.secondPhoto) row.errors?.push("Missing secondPhoto");

      rows.push(row);
    }

    return rows;
  };

  const handlePreview = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const data = parseCSV(text);
      setParsedData(data);
      toast.success(`Parsed ${data.length} rows from CSV file`);
    } catch (error) {
      toast.error(`Failed to parse file: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error("No data to import");
      return;
    }

    const validRows = parsedData.filter((row) => !row.errors || row.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("No valid rows to import. Please fix errors first.");
      return;
    }

    setIsProcessing(true);
    createPickupBulk.mutate({
      pickups: validRows.map((row) => ({
        formId: row.formId,
        supervisorId: row.supervisorId,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
        customerAddress: row.customerAddress,
        customerType: row.customerType,
        socioClass: row.socioClass,
        binType: row.binType,
        wheelieBinType: row.wheelieBinType,
        binQuantity: row.binQuantity,
        buildingId: row.buildingId,
        latitude: row.latitude,
        longitude: row.longitude,
        pickUpDate: row.pickUpDate,
        firstPhoto: row.firstPhoto,
        secondPhoto: row.secondPhoto,
        incidentReport: row.incidentReport,
        companyId: row.companyId,
        companyName: row.companyName,
        lotCode: row.lotCode,
        lotName: row.lotName,
        userId: row.userId,
      })),
    });
  };

  const downloadTemplate = () => {
    const headers = [
      "formId",
      "supervisorId",
      "customerName",
      "customerPhone",
      "customerEmail",
      "customerAddress",
      "customerType",
      "socioClass",
      "binType",
      "wheelieBinType",
      "binQuantity",
      "buildingId",
      "latitude",
      "longitude",
      "pickUpDate",
      "firstPhoto",
      "secondPhoto",
      "incidentReport",
      "companyId",
      "companyName",
      "lotCode",
      "lotName",
      "userId",
    ];

    const sampleRow = [
      "FORM-001",
      "SUP-001",
      "John Doe",
      "+1234567890",
      "john@example.com",
      "123 Main St",
      "residential",
      "medium",
      "Standard Bin",
      "240L",
      "2",
      "BLD-001",
      "6.5244",
      "3.3792",
      "Jan 26, 2026",
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
      "",
      "COMP-001",
      "Company A",
      "LOT-001",
      "Lot A",
      "USER-001",
    ];

    const csv = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pickup_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = parsedData.filter((row) => !row.errors || row.errors.length === 0);
  const invalidRows = parsedData.filter((row) => row.errors && row.errors.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Customer Import</h1>
          <p className="text-muted-foreground">
            Bulk import pickup records from CSV files
          </p>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Import Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Step 1:</strong> Download the CSV template to see the required format
            </p>
            <p>
              <strong>Step 2:</strong> Fill in your data following the template structure
            </p>
            <p>
              <strong>Step 3:</strong> Upload your CSV file and preview the data
            </p>
            <p>
              <strong>Step 4:</strong> Review for errors and click Import to add records
            </p>
            <div className="pt-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select a CSV file containing pickup records to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">CSV File</Label>
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-xs">
                    ({(file.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                disabled={!file || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Preview Data
                  </>
                )}
              </Button>
              {parsedData.length > 0 && (
                <Button
                  variant="default"
                  onClick={handleImport}
                  disabled={isProcessing || validRows.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import {validRows.length} Records
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import Result */}
        {importResult && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle className="h-5 w-5" />
                Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-green-800">
              <p>
                <strong>{importResult.success}</strong> records imported successfully
              </p>
              {importResult.failed > 0 && (
                <p className="text-red-600">
                  <strong>{importResult.failed}</strong> records failed to import
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview Table */}
        {parsedData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Review the parsed data before importing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="flex gap-4 mb-4">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validRows.length} Valid
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {invalidRows.length} Invalid
                  </Badge>
                )}
              </div>

              {/* Table */}
              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Form ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Building ID</TableHead>
                      <TableHead>Bin Type</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row) => {
                      const hasErrors = row.errors && row.errors.length > 0;
                      return (
                        <TableRow key={row.rowNumber}>
                          <TableCell className="font-mono text-xs">
                            {row.rowNumber}
                          </TableCell>
                          <TableCell>
                            {hasErrors ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.formId}
                          </TableCell>
                          <TableCell>{row.customerName || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.customerType}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.buildingId}
                          </TableCell>
                          <TableCell className="text-sm">{row.binType}</TableCell>
                          <TableCell>
                            {hasErrors ? (
                              <div className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="h-3 w-3" />
                                {row.errors?.join(", ")}
                              </div>
                            ) : (
                              <span className="text-xs text-green-600">OK</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
