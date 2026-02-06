import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Filter,
  Loader2,
  User,
  MapPin,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { Pickup } from "@shared/types";
import { toast } from "sonner";

type ValidationStatus = "pending" | "approved" | "rejected";

export default function ValidationQueue() {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [validationAction, setValidationAction] = useState<"approve" | "reject" | null>(
    null
  );
  const [validationComments, setValidationComments] = useState("");

  // Fetch data
  const { data: pickups = [], isLoading, refetch } = trpc.pickups.list.useQuery();
  const { data: validationLogs = [] } = trpc.validationLogs.list.useQuery();

  // Create validation log mutation
  const createValidationLog = trpc.validationLogs.create.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedPickup(null);
      setValidationAction(null);
      setValidationComments("");
      toast.success("Validation recorded successfully");
    },
    onError: (error) => {
      toast.error(`Failed to record validation: ${error.message}`);
    },
  });

  // Get validation status for a pickup
  const getValidationStatus = (pickupId: number): ValidationStatus => {
    const logs = validationLogs.filter(
      (log) => log.pickupId === pickupId
    );
    if (logs.length === 0) return "pending";
    const latestLog = logs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    if (latestLog.status === "approved") return "approved";
    if (latestLog.status === "rejected") return "rejected";
    return "pending";
  };

  // Filter pickups by validation status
  const filteredPickups = useMemo(() => {
    return pickups
      .filter((pickup) => {
        const status = getValidationStatus(pickup.id);
        const matchesStatus = filterStatus === "all" || status === filterStatus;

        const matchesSearch =
          searchTerm === "" ||
          pickup.formId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pickup.formId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pickup.buildingId?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        // Sort by status: pending first, then by date
        const statusA = getValidationStatus(a.id);
        const statusB = getValidationStatus(b.id);
        if (statusA === "pending" && statusB !== "pending") return -1;
        if (statusA !== "pending" && statusB === "pending") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [pickups, validationLogs, filterStatus, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const pending = pickups.filter((p) => getValidationStatus(p.id) === "pending").length;
    const approved = pickups.filter(
      (p) => getValidationStatus(p.id) === "approved"
    ).length;
    const rejected = pickups.filter(
      (p) => getValidationStatus(p.id) === "rejected"
    ).length;

    return { pending, approved, rejected, total: pickups.length };
  }, [pickups, validationLogs]);

  const handleValidation = () => {
    if (!selectedPickup || !validationAction || !user) return;

    const previousStatus = getValidationStatus(selectedPickup.id);

    createValidationLog.mutate({
      pickupId: selectedPickup.id,
      status: validationAction === "approve" ? "approved" : "rejected",
      comments: validationComments || undefined,
    });
  };

  const getStatusBadge = (status: ValidationStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Validation Queue</h1>
          <p className="text-muted-foreground">
            Review and validate pickup records submitted by field workers
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.pending / stats.total) * 100).toFixed(1)}% pending`
                  : "0% pending"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.approved / stats.total) * 100).toFixed(1)}% approved`
                  : "0% approved"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.rejected / stats.total) * 100).toFixed(1)}% rejected`
                  : "0% rejected"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Validation Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Customer name, form ID, building ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Validation Queue Table */}
        <Card>
          <CardHeader>
            <CardTitle>Validation Queue ({filteredPickups.length})</CardTitle>
            <CardDescription>
              Review pickup records and approve or reject them
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPickups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No records found matching your filters
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Building ID</TableHead>
                      <TableHead>Pickup Date</TableHead>
                      <TableHead>Field Worker</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPickups.map((pickup) => {
                      const status = getValidationStatus(pickup.id);
                      return (
                        <TableRow key={pickup.id}>
                          <TableCell className="font-mono text-xs">
                            {pickup.formId}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                Form: {pickup.formId || "N/A"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {pickup.customerType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {pickup.buildingId}
                          </TableCell>
                          <TableCell className="text-sm">{pickup.pickUpDate}</TableCell>
                          <TableCell className="text-sm">{pickup.userId}</TableCell>
                          <TableCell>{getStatusBadge(status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPickup(pickup);
                                  setValidationAction(null);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => {
                                      setSelectedPickup(pickup);
                                      setValidationAction("approve");
                                    }}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => {
                                      setSelectedPickup(pickup);
                                      setValidationAction("reject");
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation Dialog */}
      <Dialog
        open={!!selectedPickup && !!validationAction}
        onOpenChange={() => {
          setSelectedPickup(null);
          setValidationAction(null);
          setValidationComments("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {validationAction === "approve" ? "Approve" : "Reject"} Pickup Record
            </DialogTitle>
            <DialogDescription>
              Form ID: {selectedPickup?.formId}
            </DialogDescription>
          </DialogHeader>
          {selectedPickup && (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Form: {selectedPickup.formId}</span>
                  <Badge variant="outline">{selectedPickup.customerType}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Building: {selectedPickup.buildingId}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Pickup: {selectedPickup.pickUpDate}</span>
                </div>
              </div>

              {validationAction === "reject" && (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Rejection requires explanation</p>
                    <p className="text-xs mt-1">
                      Please provide comments explaining why this record is being rejected.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="comments">
                  Comments {validationAction === "reject" && "(Required)"}
                </Label>
                <Textarea
                  id="comments"
                  placeholder={
                    validationAction === "approve"
                      ? "Optional: Add any notes about this approval..."
                      : "Required: Explain why this record is being rejected..."
                  }
                  value={validationComments}
                  onChange={(e) => setValidationComments(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPickup(null);
                setValidationAction(null);
                setValidationComments("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={validationAction === "approve" ? "default" : "destructive"}
              onClick={handleValidation}
              disabled={
                createValidationLog.isPending ||
                (validationAction === "reject" && !validationComments.trim())
              }
            >
              {createValidationLog.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : validationAction === "approve" ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog (read-only) */}
      <Dialog
        open={!!selectedPickup && !validationAction}
        onOpenChange={() => setSelectedPickup(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pickup Details</DialogTitle>
            <DialogDescription>Form ID: {selectedPickup?.formId}</DialogDescription>
          </DialogHeader>
          {selectedPickup && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Validation Status:</span>
                {getStatusBadge(getValidationStatus(selectedPickup.id))}
              </div>

              {/* Customer Information */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">Form: {selectedPickup.formId || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">{selectedPickup.customerType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="text-sm">{selectedPickup.supervisorId || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="text-sm">{selectedPickup.companyName || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <h3 className="font-semibold">Photos</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedPickup.firstPhoto && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">First Photo</p>
                      <img
                        src={selectedPickup.firstPhoto}
                        alt="First photo"
                        className="w-full h-40 object-cover rounded-md border"
                      />
                    </div>
                  )}
                  {selectedPickup.secondPhoto && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Second Photo</p>
                      <img
                        src={selectedPickup.secondPhoto}
                        alt="Second photo"
                        className="w-full h-40 object-cover rounded-md border"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Validation History */}
              <div className="space-y-2">
                <h3 className="font-semibold">Validation History</h3>
                {validationLogs
                  .filter(
                    (log) =>
                      log.pickupId === selectedPickup.id
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .map((log) => (
                    <div
                      key={log.id}
                      className="border rounded-md p-3 text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {log.status === "approved" ? "Approved" : "Rejected"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.comments && (
                        <p className="text-muted-foreground">{log.comments}</p>
                      )}
                    </div>
                  ))}
                {validationLogs.filter(
                  (log) => log.pickupId === selectedPickup.id
                ).length === 0 && (
                  <p className="text-sm text-muted-foreground">No validation history</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPickup(null)}>
              Close
            </Button>
            {selectedPickup && getValidationStatus(selectedPickup.id) === "pending" && (
              <>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setValidationAction("approve")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setValidationAction("reject")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
