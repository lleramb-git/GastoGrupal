import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getUsers, type User } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Edit, Power, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface UserManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const userFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  initials: z.string().min(1, "Las iniciales son requeridas").max(3, "Máximo 3 caracteres"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
});

type UserFormData = z.infer<typeof userFormSchema>;

const predefinedColors = [
  "#3B82F6", "#8B5CF6", "#10B981", "#EF4444",
  "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6",
  "#84CC16", "#F97316", "#6366F1", "#14B8A6"
];

export default function UserManagement({ open, onOpenChange }: UserManagementProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: getUsers,
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      initials: "",
      color: predefinedColors[0],
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuario creado",
        description: "El usuario se ha creado correctamente",
      });
      form.reset();
      setIsAddingUser(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      const response = await apiRequest("PUT", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuario actualizado",
        description: "El usuario se ha actualizado correctamente",
      });
      form.reset();
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/toggle`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.active ? "Usuario activado" : "Usuario desactivado",
        description: data.active ? "El usuario ha sido reactivado" : "El usuario ha sido desactivado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el estado del usuario",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: UserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: values });
    } else {
      createUserMutation.mutate(values);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsAddingUser(true);
    form.setValue("name", user.name);
    form.setValue("initials", user.initials);
    form.setValue("color", user.color);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setIsAddingUser(false);
    form.reset();
  };

  const activeUsers = users.filter(u => u.active);
  const inactiveUsers = users.filter(u => !u.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Usuarios</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit User Form */}
          {isAddingUser ? (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingUser ? "Editar Usuario" : "Agregar Nuevo Usuario"}
                </h3>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ej: Juan Pérez" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="initials"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Iniciales (1-3 caracteres)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="JP" maxLength={3} className="uppercase" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color</FormLabel>
                          <div className="space-y-3">
                            <div className="grid grid-cols-6 gap-2">
                              {predefinedColors.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => form.setValue("color", color)}
                                  className={`w-full h-10 rounded-lg transition-all ${
                                    field.value === color ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                                  }`}
                                  style={{ backgroundColor: color }}
                                >
                                  {field.value === color && (
                                    <Check className="w-5 h-5 text-white mx-auto" />
                                  )}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Label>O elige un color personalizado:</Label>
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => form.setValue("color", e.target.value)}
                                className="w-12 h-10 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createUserMutation.isPending || updateUserMutation.isPending}
                      >
                        {editingUser ? "Actualizar" : "Crear"} Usuario
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setIsAddingUser(true)} className="w-full">
              <UserPlus className="w-4 h-4 mr-2" />
              Agregar Nuevo Usuario
            </Button>
          )}

          {/* Active Users */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Usuarios Activos ({activeUsers.length})</h3>
            <div className="space-y-2">
              {activeUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.initials}
                        </div>
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.initials}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">Activo</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserActiveMutation.mutate(user.id)}
                          className="text-destructive"
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Inactive Users */}
          {inactiveUsers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Usuarios Inactivos ({inactiveUsers.length})</h3>
              <div className="space-y-2">
                {inactiveUsers.map((user) => (
                  <Card key={user.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.initials}
                          </div>
                          <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.initials}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">Inactivo</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleUserActiveMutation.mutate(user.id)}
                            className="text-green-600"
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
