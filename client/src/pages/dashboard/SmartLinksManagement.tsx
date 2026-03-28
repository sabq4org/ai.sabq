import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Link2, Database, Tag } from "lucide-react";
import type { InsertEntityTypeDb, InsertSmartEntityDb, InsertSmartTermDb } from "@shared/schema";

interface EntityType {
  id: number;
  nameAr: string;
  nameEn: string;
  slug: string;
  description: string | null;
}

interface SmartEntity {
  id: string;
  name: string;
  typeId: number;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  aliases: string[];
  metadata?: {
    birthDate?: string;
    position?: string;
    organization?: string;
    location?: string;
    website?: string;
    social?: {
      twitter?: string;
      linkedin?: string;
      instagram?: string;
    };
  };
  entityTypeName?: string;
}

interface SmartTerm {
  id: string;
  term: string;
  description: string | null;
  category: string | null;
}

export default function SmartLinksManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("entity-types");
  const [searchQuery, setSearchQuery] = useState("");

  // Entity Types state
  const [entityTypeDialogOpen, setEntityTypeDialogOpen] = useState(false);
  const [editingEntityType, setEditingEntityType] = useState<EntityType | null>(null);
  const [deleteEntityTypeId, setDeleteEntityTypeId] = useState<number | null>(null);

  // Smart Entities state
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<SmartEntity | null>(null);
  const [deleteEntityId, setDeleteEntityId] = useState<string | null>(null);

  // Smart Terms state
  const [termDialogOpen, setTermDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<SmartTerm | null>(null);
  const [deleteTermId, setDeleteTermId] = useState<string | null>(null);

  // Fetch Entity Types
  const { data: entityTypes = [], isLoading: entityTypesLoading } = useQuery<EntityType[]>({
    queryKey: ["/api/entity-types"],
  });

  // Fetch Smart Entities
  const { data: smartEntities = [], isLoading: entitiesLoading } = useQuery<SmartEntity[]>({
    queryKey: ["/api/smart-entities"],
  });

  // Fetch Smart Terms
  const { data: smartTerms = [], isLoading: termsLoading } = useQuery<SmartTerm[]>({
    queryKey: ["/api/smart-terms"],
  });

  // Entity Type Mutations
  const createEntityTypeMutation = useMutation({
    mutationFn: async (data: InsertEntityTypeDb) => {
      return await apiRequest("/api/entity-types", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entity-types"] });
      setEntityTypeDialogOpen(false);
      toast({ title: "تم إنشاء نوع الكيان بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إنشاء نوع الكيان", variant: "destructive" });
    },
  });

  const updateEntityTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertEntityTypeDb> }) => {
      return await apiRequest(`/api/entity-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entity-types"] });
      setEntityTypeDialogOpen(false);
      setEditingEntityType(null);
      toast({ title: "تم تحديث نوع الكيان بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء تحديث نوع الكيان", variant: "destructive" });
    },
  });

  const deleteEntityTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/entity-types/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entity-types"] });
      setDeleteEntityTypeId(null);
      toast({ title: "تم حذف نوع الكيان بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء حذف نوع الكيان", variant: "destructive" });
    },
  });

  // Smart Entity Mutations
  const createEntityMutation = useMutation({
    mutationFn: async (data: InsertSmartEntityDb) => {
      return await apiRequest("/api/smart-entities", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-entities"] });
      setEntityDialogOpen(false);
      toast({ title: "تم إنشاء الكيان بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إنشاء الكيان", variant: "destructive" });
    },
  });

  const updateEntityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSmartEntityDb> }) => {
      return await apiRequest(`/api/smart-entities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-entities"] });
      setEntityDialogOpen(false);
      setEditingEntity(null);
      toast({ title: "تم تحديث الكيان بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء تحديث الكيان", variant: "destructive" });
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/smart-entities/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-entities"] });
      setDeleteEntityId(null);
      toast({ title: "تم حذف الكيان بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء حذف الكيان", variant: "destructive" });
    },
  });

  // Smart Term Mutations
  const createTermMutation = useMutation({
    mutationFn: async (data: InsertSmartTermDb) => {
      return await apiRequest("/api/smart-terms", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-terms"] });
      setTermDialogOpen(false);
      toast({ title: "تم إنشاء المصطلح بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إنشاء المصطلح", variant: "destructive" });
    },
  });

  const updateTermMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSmartTermDb> }) => {
      return await apiRequest(`/api/smart-terms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-terms"] });
      setTermDialogOpen(false);
      setEditingTerm(null);
      toast({ title: "تم تحديث المصطلح بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء تحديث المصطلح", variant: "destructive" });
    },
  });

  const deleteTermMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/smart-terms/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-terms"] });
      setDeleteTermId(null);
      toast({ title: "تم حذف المصطلح بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء حذف المصطلح", variant: "destructive" });
    },
  });

  // Filter data based on search
  const filteredEntityTypes = entityTypes.filter((type) =>
    type.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.nameEn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEntities = smartEntities.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (entity.entityTypeName && entity.entityTypeName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTerms = smartTerms.filter((term) =>
    term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (term.category && term.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold">الروابط الذكية</h1>
          <p className="text-muted-foreground mt-2">
            إدارة أنواع الكيانات والكيانات الذكية والمصطلحات المرتبطة بها
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-3" dir="rtl">
            <TabsTrigger value="entity-types" className="gap-2" data-testid="tab-entity-types">
              <Database className="h-4 w-4" />
              أنواع الكيانات
            </TabsTrigger>
            <TabsTrigger value="entities" className="gap-2" data-testid="tab-entities">
              <Link2 className="h-4 w-4" />
              الكيانات الذكية
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-2" data-testid="tab-terms">
              <Tag className="h-4 w-4" />
              المصطلحات
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search"
                />
              </div>
            </CardContent>
          </Card>

          {/* Entity Types Tab */}
          <TabsContent value="entity-types" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>أنواع الكيانات</CardTitle>
                    <CardDescription>
                      إدارة أنواع الكيانات المستخدمة في نظام الروابط الذكية
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingEntityType(null);
                      setEntityTypeDialogOpen(true);
                    }}
                    className="gap-2"
                    data-testid="button-add-entity-type"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة نوع جديد
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {entityTypesLoading ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : filteredEntityTypes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد أنواع كيانات
                  </div>
                ) : (
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم العربي</TableHead>
                        <TableHead className="text-right">الاسم الإنجليزي</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="w-24 text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntityTypes.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-medium text-right">{type.nameAr}</TableCell>
                          <TableCell className="text-muted-foreground text-right">{type.nameEn}</TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {type.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingEntityType(type);
                                  setEntityTypeDialogOpen(true);
                                }}
                                data-testid={`button-edit-entity-type-${type.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteEntityTypeId(type.id)}
                                data-testid={`button-delete-entity-type-${type.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Entities Tab */}
          <TabsContent value="entities" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>الكيانات الذكية</CardTitle>
                    <CardDescription>
                      إدارة الكيانات الذكية والروابط المرتبطة بها
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingEntity(null);
                      setEntityDialogOpen(true);
                    }}
                    className="gap-2"
                    data-testid="button-add-entity"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة كيان جديد
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {entitiesLoading ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : filteredEntities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد كيانات ذكية
                  </div>
                ) : (
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="w-24 text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntities.map((entity) => (
                        <TableRow key={entity.id}>
                          <TableCell className="font-medium text-right">{entity.name}</TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {entity.entityTypeName || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {entity.description ? entity.description.substring(0, 50) + "..." : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingEntity(entity);
                                  setEntityDialogOpen(true);
                                }}
                                data-testid={`button-edit-entity-${entity.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteEntityId(entity.id)}
                                data-testid={`button-delete-entity-${entity.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Terms Tab */}
          <TabsContent value="terms" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>المصطلحات الذكية</CardTitle>
                    <CardDescription>
                      إدارة المصطلحات المرتبطة بالكيانات الذكية
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingTerm(null);
                      setTermDialogOpen(true);
                    }}
                    className="gap-2"
                    data-testid="button-add-term"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة مصطلح جديد
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {termsLoading ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : filteredTerms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد مصطلحات ذكية
                  </div>
                ) : (
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المصطلح</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="w-24 text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTerms.map((term) => (
                        <TableRow key={term.id}>
                          <TableCell className="font-medium text-right">{term.term}</TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {term.category || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {term.description ? term.description.substring(0, 50) + "..." : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingTerm(term);
                                  setTermDialogOpen(true);
                                }}
                                data-testid={`button-edit-term-${term.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTermId(term.id)}
                                data-testid={`button-delete-term-${term.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Entity Type Dialog */}
        <EntityTypeDialog
          open={entityTypeDialogOpen}
          onOpenChange={setEntityTypeDialogOpen}
          entityType={editingEntityType}
          onSave={(data) => {
            if (editingEntityType) {
              updateEntityTypeMutation.mutate({ id: editingEntityType.id, data });
            } else {
              createEntityTypeMutation.mutate(data as InsertEntityTypeDb);
            }
          }}
          isPending={createEntityTypeMutation.isPending || updateEntityTypeMutation.isPending}
        />

        {/* Smart Entity Dialog */}
        <SmartEntityDialog
          open={entityDialogOpen}
          onOpenChange={setEntityDialogOpen}
          entity={editingEntity}
          entityTypes={entityTypes}
          onSave={(data) => {
            if (editingEntity) {
              updateEntityMutation.mutate({ id: editingEntity.id, data });
            } else {
              createEntityMutation.mutate(data as InsertSmartEntityDb);
            }
          }}
          isPending={createEntityMutation.isPending || updateEntityMutation.isPending}
        />

        {/* Smart Term Dialog */}
        <SmartTermDialog
          open={termDialogOpen}
          onOpenChange={setTermDialogOpen}
          term={editingTerm}
          onSave={(data) => {
            if (editingTerm) {
              updateTermMutation.mutate({ id: editingTerm.id, data });
            } else {
              createTermMutation.mutate(data as InsertSmartTermDb);
            }
          }}
          isPending={createTermMutation.isPending || updateTermMutation.isPending}
        />

        {/* Delete Confirmations */}
        <AlertDialog open={!!deleteEntityTypeId} onOpenChange={() => setDeleteEntityTypeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف نوع الكيان وجميع الكيانات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteEntityTypeId && deleteEntityTypeMutation.mutate(deleteEntityTypeId)}
                className="bg-destructive hover:bg-destructive/90"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteEntityId} onOpenChange={() => setDeleteEntityId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف الكيان وجميع المصطلحات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteEntityId && deleteEntityMutation.mutate(deleteEntityId)}
                className="bg-destructive hover:bg-destructive/90"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTermId} onOpenChange={() => setDeleteTermId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف المصطلح. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTermId && deleteTermMutation.mutate(deleteTermId)}
                className="bg-destructive hover:bg-destructive/90"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

// Entity Type Dialog Component
function EntityTypeDialog({
  open,
  onOpenChange,
  entityType,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType | null;
  onSave: (data: Partial<InsertEntityTypeDb>) => void;
  isPending: boolean;
}) {
  const [nameAr, setNameAr] = useState(entityType?.nameAr || "");
  const [nameEn, setNameEn] = useState(entityType?.nameEn || "");
  const [slug, setSlug] = useState(entityType?.slug || "");
  const [description, setDescription] = useState(entityType?.description || "");

  // Reset form when dialog opens or entityType changes
  useEffect(() => {
    if (open) {
      setNameAr(entityType?.nameAr || "");
      setNameEn(entityType?.nameEn || "");
      setSlug(entityType?.slug || "");
      setDescription(entityType?.description || "");
    }
  }, [open, entityType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      nameAr, 
      nameEn, 
      slug,
      description: description || undefined,
      displayOrder: 0,
      status: "active"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {entityType ? "تعديل نوع الكيان" : "إضافة نوع كيان جديد"}
            </DialogTitle>
            <DialogDescription>
              أضف معلومات نوع الكيان أدناه
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nameAr">الاسم العربي *</Label>
              <Input
                id="nameAr"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: شخصية، منظمة، مكان"
                required
                data-testid="input-entity-type-name-ar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameEn">الاسم الإنجليزي *</Label>
              <Input
                id="nameEn"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Example: Person, Organization, Location"
                required
                data-testid="input-entity-type-name-en"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">المعرّف (Slug) *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="person-organization-location"
                required
                data-testid="input-entity-type-slug"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف نوع الكيان (اختياري)"
                rows={3}
                data-testid="input-entity-type-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-entity-type">
              {isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Smart Entity Dialog Component
function SmartEntityDialog({
  open,
  onOpenChange,
  entity,
  entityTypes,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: SmartEntity | null;
  entityTypes: EntityType[];
  onSave: (data: Partial<InsertSmartEntityDb>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(entity?.name || "");
  const [typeId, setTypeId] = useState<string>(entity?.typeId?.toString() || "");
  const [slug, setSlug] = useState(entity?.slug || "");
  const [description, setDescription] = useState(entity?.description || "");
  const [imageUrl, setImageUrl] = useState(entity?.imageUrl || "");
  const [aliases, setAliases] = useState(entity?.aliases?.join(", ") || "");
  
  // Metadata fields
  const [position, setPosition] = useState("");
  const [organization, setOrganization] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  // Reset form when dialog opens or entity changes
  useEffect(() => {
    if (open) {
      setName(entity?.name || "");
      setTypeId(entity?.typeId?.toString() || "");
      setSlug(entity?.slug || "");
      setDescription(entity?.description || "");
      setImageUrl(entity?.imageUrl || "");
      setAliases(entity?.aliases?.join(", ") || "");
      
      // Load metadata if exists
      const meta = entity?.metadata as any;
      setPosition(meta?.position || "");
      setOrganization(meta?.organization || "");
      setBirthDate(meta?.birthDate || "");
      setLocation(meta?.location || "");
      setWebsite(meta?.website || "");
      setTwitter(meta?.social?.twitter || "");
      setLinkedin(meta?.social?.linkedin || "");
      setInstagram(meta?.social?.instagram || "");
    } else {
      // Reset form when dialog closes
      setName("");
      setTypeId("");
      setSlug("");
      setDescription("");
      setImageUrl("");
      setAliases("");
      setPosition("");
      setOrganization("");
      setBirthDate("");
      setLocation("");
      setWebsite("");
      setTwitter("");
      setLinkedin("");
      setInstagram("");
    }
  }, [open, entity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build metadata object
    const metadata: any = {};
    if (position) metadata.position = position;
    if (organization) metadata.organization = organization;
    if (birthDate) metadata.birthDate = birthDate;
    if (location) metadata.location = location;
    if (website) metadata.website = website;
    
    // Add social media if any field is filled
    if (twitter || linkedin || instagram) {
      metadata.social = {};
      if (twitter) metadata.social.twitter = twitter;
      if (linkedin) metadata.social.linkedin = linkedin;
      if (instagram) metadata.social.instagram = instagram;
    }
    
    onSave({
      name,
      typeId: parseInt(typeId),
      slug,
      description: description || null,
      imageUrl: imageUrl || null,
      aliases: aliases ? aliases.split(",").map((a: string) => a.trim()).filter(Boolean) : [],
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      importanceScore: 0.5,
      status: "active",
    });
  };

  const { toast } = useToast();
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const generateDescription = async () => {
    if (!name || !typeId) {
      toast({ title: "الرجاء إدخال الاسم والنوع أولاً", variant: "destructive" });
      return;
    }

    setGeneratingDescription(true);
    try {
      const entityType = entityTypes.find(t => t.id.toString() === typeId);
      const context = {
        name,
        type: entityType?.nameAr,
        position,
        organization,
        location,
      };
      
      const response = await apiRequest("/api/ai/generate-entity-description", {
        method: "POST",
        body: JSON.stringify(context),
      });
      
      setDescription(response.description);
      toast({ title: "تم توليد التعريف بنجاح" });
    } catch (error) {
      toast({ title: "فشل توليد التعريف", variant: "destructive" });
    } finally {
      setGeneratingDescription(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {entity ? "تعديل الكيان الذكي" : "إضافة كيان ذكي جديد"}
            </DialogTitle>
            <DialogDescription>
              أضف معلومات الكيان الذكي أدناه. الحقول المطلوبة مشارة بـ *
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Basic Info Section */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold text-sm">المعلومات الأساسية</h3>
              
              <div className="space-y-2">
                <Label htmlFor="entity-name">الاسم *</Label>
                <Input
                  id="entity-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد بن سلمان، أرامكو"
                  required
                  data-testid="input-entity-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="entity-type">النوع *</Label>
                <Select value={typeId} onValueChange={setTypeId} required>
                  <SelectTrigger data-testid="select-entity-type">
                    <SelectValue placeholder="اختر نوع الكيان" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="entity-slug">المعرّف (Slug) *</Label>
                <Input
                  id="entity-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="mohammed-bin-salman"
                  required
                  data-testid="input-entity-slug"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="entity-aliases">الأسماء المستعارة (مفصولة بفواصل)</Label>
                <Input
                  id="entity-aliases"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="مثال: MBS, ولي العهد، الأمير محمد"
                  data-testid="input-entity-aliases"
                />
                <p className="text-xs text-muted-foreground">
                  اكتب الأسماء المستعارة مفصولة بفواصل
                </p>
              </div>
            </div>

            {/* Description Section with AI */}
            <div className="space-y-4 p-4 border rounded-lg bg-accent/5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">التعريف والوصف</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateDescription}
                  disabled={generatingDescription || !name || !typeId}
                  data-testid="button-generate-description"
                >
                  {generatingDescription ? "جاري التوليد..." : "🤖 توليد تلقائي بالذكاء الاصطناعي"}
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="entity-description">الوصف والتعريف</Label>
                <Textarea
                  id="entity-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف وتعريف الكيان (اختياري) - أو استخدم التوليد التلقائي"
                  rows={4}
                  data-testid="input-entity-description"
                />
              </div>
            </div>

            {/* Media Section */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold text-sm">الصورة</h3>
              
              <div className="space-y-2">
                <Label htmlFor="entity-image-file">رفع صورة</Label>
                <Input
                  id="entity-image-file"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    // رفع الصورة
                    const formData = new FormData();
                    formData.append('image', file);
                    
                    try {
                      const response = await fetch("/api/smart-entities/upload-image", {
                        method: "POST",
                        body: formData,
                        credentials: "include",
                      });
                      
                      if (!response.ok) {
                        throw new Error("فشل رفع الصورة");
                      }
                      
                      const data = await response.json();
                      setImageUrl(data.imageUrl);
                      toast({ title: "تم رفع الصورة بنجاح" });
                    } catch (error) {
                      toast({ title: "فشل رفع الصورة", variant: "destructive" });
                    }
                  }}
                  data-testid="input-entity-image-file"
                />
                <p className="text-xs text-muted-foreground">
                  اختر صورة بصيغة JPG, PNG, أو GIF
                </p>
                {imageUrl && (
                  <div className="mt-2">
                    <img src={imageUrl} alt="معاينة" className="h-32 w-32 object-cover rounded-md border" />
                  </div>
                )}
              </div>
            </div>

            {/* Metadata Section */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold text-sm">معلومات إضافية</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entity-position">المنصب / الوظيفة</Label>
                  <Input
                    id="entity-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="مثال: ولي العهد، الرئيس التنفيذي"
                    data-testid="input-entity-position"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entity-organization">المنظمة / الجهة</Label>
                  <Input
                    id="entity-organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="مثال: الحكومة السعودية، أرامكو"
                    data-testid="input-entity-organization"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entity-birthdate">تاريخ الميلاد / التأسيس</Label>
                  <Input
                    id="entity-birthdate"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="مثال: 31 أغسطس 1985"
                    data-testid="input-entity-birthdate"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entity-location">الموقع / المقر</Label>
                  <Input
                    id="entity-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثال: الرياض، السعودية"
                    data-testid="input-entity-location"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="entity-website">الموقع الإلكتروني</Label>
                <Input
                  id="entity-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  data-testid="input-entity-website"
                />
              </div>
            </div>

            {/* Social Media Section */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold text-sm">وسائل التواصل الاجتماعي</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="entity-twitter">تويتر / X</Label>
                  <Input
                    id="entity-twitter"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="https://twitter.com/username أو @username"
                    data-testid="input-entity-twitter"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entity-linkedin">لينكد إن</Label>
                  <Input
                    id="entity-linkedin"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    data-testid="input-entity-linkedin"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entity-instagram">انستغرام</Label>
                  <Input
                    id="entity-instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="https://instagram.com/username أو @username"
                    data-testid="input-entity-instagram"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-entity">
              {isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Smart Term Dialog Component
function SmartTermDialog({
  open,
  onOpenChange,
  term,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: SmartTerm | null;
  onSave: (data: Partial<InsertSmartTermDb>) => void;
  isPending: boolean;
}) {
  const [termText, setTermText] = useState(term?.term || "");
  const [category, setCategory] = useState(term?.category || "");
  const [description, setDescription] = useState(term?.description || "");

  // Reset form when dialog opens or term changes
  useEffect(() => {
    if (open) {
      setTermText(term?.term || "");
      setCategory(term?.category || "");
      setDescription(term?.description || "");
    }
  }, [open, term]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      term: termText,
      category: category || null,
      description: description || null,
      aliases: [],
      status: "active",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {term ? "تعديل المصطلح" : "إضافة مصطلح جديد"}
            </DialogTitle>
            <DialogDescription>
              أضف معلومات المصطلح أدناه
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="term-text">المصطلح *</Label>
              <Input
                id="term-text"
                value={termText}
                onChange={(e) => setTermText(e.target.value)}
                placeholder="مثال: الذكاء الاصطناعي، الطاقة المتجددة"
                required
                data-testid="input-term-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-category">الفئة</Label>
              <Input
                id="term-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="مثال: تقنية، اقتصاد، سياسة"
                data-testid="input-term-category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-description">الوصف</Label>
              <Textarea
                id="term-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف المصطلح (اختياري)"
                rows={3}
                data-testid="input-term-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-term">
              {isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
