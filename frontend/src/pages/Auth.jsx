import React from "react";
import { LogIn, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Login from "@/components/Auth/Login";
import Register from "@/components/Auth/Register";

const Auth = ({ open, onOpenChange, defaultTab = "login" }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Welcome to World of Minifigs
          </DialogTitle>
          <DialogDescription className="sr-only">
            Please sign in to your account to continue.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid grid-cols-2 w-full mb-5">
            <TabsTrigger value="login">
              <LogIn size={18} />
              Login
            </TabsTrigger>
            <TabsTrigger value="register">
              <UserPlus size={18} />
              Register
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Login />
          </TabsContent>
          <TabsContent value="register">
            <Register />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default Auth;
