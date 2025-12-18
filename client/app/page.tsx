"use client";

// gobal imports
import Image from "next/image";
import { useRouter } from "next/navigation";

// local imports
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const {data, isPending} = authClient.useSession();
  const router = useRouter();

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner />
      </div>
    )
  }

  if(!data?.session && !data?.user) {
    router.push('/sign-in')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <div className="w-full max-w-md px-4">
        <div className="space-y-8">
          {/* Profile Header Card */}
          <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 bg-zinc-900/50 backdrop-blur-sm">
          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img
              src={data?.user?.image || "/vercel.svg"}
              alt={data?.user?.name || "User Avatar"}
              width={120}
              height={120}
              className="rounded-full border-2 border-dashed border-zinc-600 object-cover" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-2 border-zinc-900"></div>
            </div>
          </div>

          {/* User Info */}
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-bold text-zinc-50 truncate">Welcome, {data?.user?.name || "User"}</h1>
            <p className="text-sm text-zinc-400">Authenticated User</p>
          </div>
          </div>

          {/* User details Card */}
          
  );
}
