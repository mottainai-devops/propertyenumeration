import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, Eye, Trash2, Filter, Calendar, MapPin, Phone, Mail, User, Building2, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import type { Pickup } from "@shared/types";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterCustomerType, setFilterCustomerType] = useState<string>("all");
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Fetch data
  const { data: pickups = [], isLoading, refetch } = trpc.pickups.list.useQuery();
  const { data: companies = [] } = trpc.companies.list.useQuery();
  const deletePickup = trpc.pickups.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeleteConfirmId(null);
    },
  });

  // Filter and search logic
  const filteredPickups = useMemo(() => {
    return pickups.filter((pickup) => {
      const matchesSearch =
        searchTerm === "" ||
        pickup.formId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pickup.buildingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pickup.formId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompany =
        filterCompany === "all" || pickup.companyName === filterCompany;

      const matchesType =
        filterCustomerType === "all" || pickup.customerType === filterCustomerType;

      return matchesSearch && matchesCompany && matchesType;
    });
  }, [pickups, searchTerm, filterCompany, filterCustomerType]);

  const handleDelete = (id: number) => {
    deletePickup.mutate({ id });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Pickups / Customers</h1>
          <p className="text-muted-foreground">
            View and manage customer pickup records from field surveys
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pickups</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pickups.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Residential</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pickups.filter((p) => p.customerType === "residential").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commercial</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pickups.filter((p) => p.customerType === "commercial").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Synced</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pickups.filter((p) => p.synced === 1).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Name, phone, building ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger id="company">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.name}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Customer Type</Label>
                <Select value={filterCustomerType} onValueChange={setFilterCustomerType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="institutional">Institutional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pickups Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pickup Records ({filteredPickups.length})</CardTitle>
            <CardDescription>
              Customer registrations from field workers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPickups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pickup records found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Building ID</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Pickup Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPickups.map((pickup) => (
                      <TableRow key={pickup.id}>
                        <TableCell className="font-mono text-xs">
                          {pickup.formId}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">Form: {pickup.formId || "N/A"}</span>
                            {pickup.supervisorId && (
                              <span className="text-xs text-muted-foreground">
                                Supervisor: {pickup.supervisorId}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{pickup.customerType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {pickup.buildingId}
                        </TableCell>
                        <TableCell className="text-sm">
                          {pickup.companyName || "N/A"}
                        </TableCell>
                        <TableCell className="text-sm">{pickup.pickUpDate}</TableCell>
                        <TableCell>
                          {pickup.synced === 1 ? (
                            <Badge variant="default" className="bg-green-500">
                              Synced
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPickup(pickup)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmId(pickup.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Details Dialog */}
      <Dialog open={!!selectedPickup} onOpenChange={() => setSelectedPickup(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pickup Details</DialogTitle>
            <DialogDescription>Form ID: {selectedPickup?.formId}</DialogDescription>
          </DialogHeader>
          {selectedPickup && (
            <div className="space-y-4">
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
                    <p className="font-medium">{selectedPickup.supervisorId || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{selectedPickup.companyName || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium">{selectedPickup.buildingId || "N/A"}</p>
                  </div>
                  {selectedPickup.socioClass && (
                    <div>
                      <span className="text-muted-foreground">Socio Class:</span>
                      <p className="font-medium">{selectedPickup.socioClass}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bin Information */}
              <div className="space-y-2">
                <h3 className="font-semibold">Bin Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Bin Type:</span>
                    <p className="font-medium">{selectedPickup.binType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantity:</span>
                    <p className="font-medium">{selectedPickup.binQuantity}</p>
                  </div>
                  {selectedPickup.wheelieBinType && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Wheelie Bin Type:</span>
                      <p className="font-medium">{selectedPickup.wheelieBinType}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Building ID:</span>
                    <p className="font-medium font-mono">{selectedPickup.buildingId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Coordinates:</span>
                    <p className="font-medium font-mono">
                      {selectedPickup.latitude && selectedPickup.longitude
                        ? `${parseFloat(selectedPickup.latitude).toFixed(6)}, ${parseFloat(selectedPickup.longitude).toFixed(6)}`
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Company/Lot Information */}
              <div className="space-y-2">
                <h3 className="font-semibold">Company & Lot</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Company:</span>
                    <p className="font-medium">{selectedPickup.companyName || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lot:</span>
                    <p className="font-medium">{selectedPickup.lotName || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Pickup Details */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Pickup Details
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Pickup Date:</span>
                    <p className="font-medium">{selectedPickup.pickUpDate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supervisor ID:</span>
                    <p className="font-medium">{selectedPickup.supervisorId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Field Worker:</span>
                    <p className="font-medium">{selectedPickup.userId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p>
                      {selectedPickup.synced === 1 ? (
                        <Badge variant="default" className="bg-green-500">
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </p>
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

              {/* Incident Report */}
              {selectedPickup.incidentReport && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Incident Report</h3>
                  <p className="text-sm bg-muted p-3 rounded-md">
                    {selectedPickup.incidentReport}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Created: {new Date(selectedPickup.createdAt).toLocaleString()}</p>
                <p>Updated: {new Date(selectedPickup.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPickup(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pickup Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pickup record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deletePickup.isPending}
            >
              {deletePickup.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
