"use client";
import { UserDetailContext } from "@/context/UserDetailContext";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { User } from "lucide-react";
import React, { createContext, use, useEffect, useState } from "react";

function Provider({ children }: any) {
  const { user } = useUser();
  const createUserMutation = useMutation(api.users.CreateNewUser);
  const [userDetail, setUserDetail] = useState<any>(null);

  // When Clerk provides a user, ensure a corresponding Convex user exists.
  useEffect(() => {
    async function ensureUser() {
      if (!user) return;
      try {
        const result = await createUserMutation({
          email: user?.primaryEmailAddress?.emailAddress ?? "",
          imageUrl: user?.imageUrl ?? "",
          name: user?.fullName ?? "",
        });
        // `result` should contain the created or existing user document
        setUserDetail(result);
      } catch (err) {
        console.error("CreateNewUser failed", err);
      }
    }
    ensureUser();
  }, [user, createUserMutation]);

  return (
    <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
      <div>{children}</div>
    </UserDetailContext.Provider>
  );
}

export default Provider;

export const useUserDetailContext = () => {
  return createContext(UserDetailContext);
};
