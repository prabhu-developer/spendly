"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { CURRENCY_LIST, SupportedCurrency } from "@/lib/currency/currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { Check, Shield, User, Globe, KeyRound, LogOut } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Profile Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>("USD");
  const [dateFormat, setDateFormat] = useState("MM/dd/yyyy");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const { data: userData, refetch: refetchUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data.user;
    },
  });

  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setEmail(userData.email || "");
      setPreferredCurrency(userData.preferredCurrency || "USD");
      setDateFormat(userData.dateFormat || "MM/dd/yyyy");
    }
  }, [userData]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");
    setIsUpdatingProfile(true);

    try {
      await apiClient.put("/user/profile", {
        name,
        preferredCurrency,
        dateFormat,
      });
      setProfileSuccess("Profile settings updated successfully!");
      refetchUser();
      queryClient.invalidateQueries();
      router.refresh();
    } catch (err: any) {
      setProfileError(err.response?.data?.error || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await apiClient.put("/user/password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || "Failed to change password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#202735]">Account Settings</h2>
        <p className="text-xs text-[#8992A3]">
          Manage your personal details, display currency, date formatting, and security settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Profile & Currency Form */}
        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#2878E5]" />
              <CardTitle className="text-base font-semibold">Profile & Preferences</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Your preferred currency dynamically converts all amounts across your overview, reports, and budgets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-[#EAF6F1] p-3 text-xs text-[#269B72]">
                  <Check className="h-4 w-4" />
                  {profileSuccess}
                </div>
              )}
              {profileError && (
                <div className="rounded-lg bg-[#FDF1EE] p-3 text-xs text-[#F07862]">
                  {profileError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" value={email} disabled className="bg-[#F3F6FC] cursor-not-allowed" />
                  <span className="text-[10px] text-[#8992A3]">Email cannot be changed</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Preferred Display Currency</Label>
                  <Select
                    value={preferredCurrency}
                    onValueChange={(val) => setPreferredCurrency(val as SupportedCurrency)}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_LIST.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} — {c.name} ({c.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/dd/yyyy">MM/dd/yyyy (US)</SelectItem>
                      <SelectItem value="dd/MM/yyyy">dd/MM/yyyy (UK/India/EU)</SelectItem>
                      <SelectItem value="yyyy-MM-dd">yyyy-MM-dd (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="bg-[#2878E5] hover:bg-[#1F65C2]"
                >
                  {isUpdatingProfile ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#2878E5]" />
              <CardTitle className="text-base font-semibold">Security & Password</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Change your login password. Must be at least 8 characters with 1 uppercase letter and 1 number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-[#EAF6F1] p-3 text-xs text-[#269B72]">
                  <Check className="h-4 w-4" />
                  {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="rounded-lg bg-[#FDF1EE] p-3 text-xs text-[#F07862]">
                  {passwordError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="bg-[#2878E5] hover:bg-[#1F65C2]"
                >
                  {isUpdatingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Account Session Logout */}
        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#202735]">Account Session</CardTitle>
            <CardDescription className="text-xs">
              Securely terminate your current session on this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center">
            <span className="text-xs text-[#8992A3]">
              You will need to enter your email and password to log in again.
            </span>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="gap-2 border-[#E8EDF4] text-[#F07862] hover:bg-[#FDF1EE] hover:text-[#F07862]"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
