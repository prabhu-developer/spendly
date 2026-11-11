"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterInput } from "@/lib/validations/auth";
import { CURRENCY_LIST, SupportedCurrency } from "@/lib/currency/currencies";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Lock, Mail, User, Globe } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      preferredCurrency: "USD",
    },
  });

  const selectedCurrency = watch("preferredCurrency");

  const onSubmit = async (data: RegisterInput) => {
    setErrorMessage("");
    try {
      const res = await apiClient.post("/auth/register", data);
      if (res.data.success) {
        // Immediate access after registration: redirect to dashboard
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || "Registration failed. Please check your information."
      );
    }
  };

  return (
    <Card className="border border-border bg-white shadow-sm">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-main">
          Create an Account
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Start tracking your finances with intelligent multi-currency insights
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
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Prabhu"
                className="pl-9"
                {...register("name")}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-expense-text">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="prabhu@example.com"
                className="pl-9"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-expense-text">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Preferred Currency</Label>
            <Select
              value={selectedCurrency}
              onValueChange={(val) => setValue("preferredCurrency", val as SupportedCurrency)}
            >
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_LIST.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Can be changed at any time in Settings.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters, 1 uppercase, 1 number"
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
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating Account..." : "Register & Start"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-border pt-4 text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="ml-1 font-semibold text-primary-text hover:underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
