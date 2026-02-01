import React, { useContext, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResumeUpload from "./ResumeUpload";
import JobDescription from "./JobDescription";
import axios from "axios";
import { log } from "node:console";
import { Loader2Icon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useUserDetailContext } from "@/app/Provider";
import { UserDetailContext } from "@/context/UserDetailContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import D_IDStreamingAvatar from "@/components/D_IDStreamingAvatar";

interface AvatarStreamData {
  streamId: string;
  offer: RTCSessionDescriptionInit;
  ice_servers: RTCIceServer[];
  session_id: string;
}

function CreateInterviewDialog() {
  const [formData, setFormData] = useState<any>({});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [avatarData, setAvatarData] = useState<AvatarStreamData | null>(null);
  const { userDetail, setUserDetail } = useContext(UserDetailContext);
  const saveInterviewQuestion = useMutation(
    api.Interview.SaveInterviewQuestion
  );
  const router = useRouter();

  const onHandleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async () => {
    setLoading(true);
    const formData_ = new FormData();
    // Only append the file if one was selected (job description-only flows
    // should not send an empty string as the file field).
    if (file) {
      formData_.append("file", file);
    }
    if (formData?.jobTitle) {
      formData_.append("jobTitle", formData.jobTitle);
    }
    if (formData?.jobDescription) {
      formData_.append("jobDescription", formData.jobDescription);
    }
    try {
      // Use the new endpoint that includes D-ID avatar streaming
      const res = await axios.post(
        "/api/generate-interview-questions-with-avatar",
        formData_
      );
      console.log(res.data);

      // Show avatar while questions are being processed
      if (res.data?.avatar) {
        setAvatarData(res.data.avatar);
        setShowAvatar(true);
      }

      // Normalize questions to an array (may be empty). We want to store the
      // session even when no questions were generated.
      let questions: any[] = [];
      const raw = res.data?.questions ?? res.data?.data ?? [];
      if (typeof raw === "string") {
        toast.warning(res?.data?.result);
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) questions = parsed;
        } catch (err) {
          console.warn(
            "Could not parse questions string, storing empty array.",
            err
          );
        }
      } else if (Array.isArray(raw)) {
        questions = raw;
      }

      // Always save the interview session (questions may be empty)
      //@ts-ignore
      const interviewId = await saveInterviewQuestion({
        questions,
        resumeUrl: res.data?.resumeUrl ?? "",
        uid: userDetail?._id,
        jobTitle: formData?.jobTitle ?? "",
        jobDescription: formData?.jobDescription ?? "",
      });
      console.log("saveInterviewQuestion result:", interviewId);
      if (interviewId) {
        toast.success("Interview saved");
        // Wait a moment to let avatar finish speaking before redirecting
        setTimeout(() => {
          router.push("/interview/" + interviewId);
        }, 3000);
        return;
      } else {
        toast.error("Failed to save interview session");
      }

      router.push("/interview/" + interviewId);
    } catch (e) {
      console.log(e);
      toast.error("Failed to generate interview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ Create Interview</Button>
      </DialogTrigger>
      <DialogContent className="min-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Please submit following details.</DialogTitle>
          <DialogDescription>
            {showAvatar && avatarData ? (
              <div className="w-full mt-5">
                <p className="text-sm mb-3 text-gray-400">
                  Avatar is greeting you...
                </p>
                <D_IDStreamingAvatar
                  streamId={avatarData.streamId}
                  offer={avatarData.offer}
                  iceServers={avatarData.ice_servers}
                  sessionId={avatarData.session_id}
                  className="w-full aspect-video bg-black rounded-lg"
                  onError={(error) => {
                    console.error("Avatar error:", error);
                    toast.error("Avatar streaming failed: " + error);
                  }}
                />
              </div>
            ) : (
              <Tabs defaultValue="resume-upload" className="w-full mt-5">
                <TabsList>
                  <TabsTrigger value="resume-upload">Resume Upload</TabsTrigger>
                  <TabsTrigger value="job-description">
                    Job Description
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="resume-upload">
                  {" "}
                  <ResumeUpload setFiles={(file: File) => setFile(file)} />
                </TabsContent>
                <TabsContent value="job-description">
                  <JobDescription onHandleInputChange={onHandleInputChange} />
                </TabsContent>
              </Tabs>
            )}
          </DialogDescription>
        </DialogHeader>
        {!showAvatar && (
          <DialogFooter className="flex gap-6">
            <DialogClose asChild>
              <Button variant={"ghost"}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={onSubmit}
              // Enable submit when loading is false and either a file is present
              // or the user has provided a job title/description.
              disabled={
                loading ||
                (!file && !formData?.jobTitle && !formData?.jobDescription)
              }
            >
              {loading && <Loader2Icon className="animate-spin" />}Submit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CreateInterviewDialog;
