"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { LoginInput, loginSchema } from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isLoading, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setErrorMessage("");
    try {
      const res = await apiClient.post("/auth/login", data);
      if (res.data.success) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || "Login failed. Please verify your credentials."
      );
    }
  };

  return (
    <Card className="border border-border bg-white shadow-sm">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-main">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Enter your email and password to access your Spendly dashboard
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-expense-light p-3 text-xs text-expense-text">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="pl-9"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-expense-text">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-9"
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-expense-text">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? "Signing In..." : "Sign In"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-border pt-4 text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="ml-1 font-semibold text-primary-text hover:underline"
        >
          Create account
        </Link>
      </CardFooter>
    </Card>
  );
}
