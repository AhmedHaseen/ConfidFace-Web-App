"use client";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Star, Target, Lightbulb, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.interviewId as string;
  const [expandedSections, setExpandedSections] = useState({
    overall: true,
    strengths: false,
    improvements: false,
    recommendations: false,
  });

  // Fetch interview data directly from Convex
  const interviewData = useQuery(
    api.Interview.GetInterviewQuestions,
    interviewId
      ? {
          //@ts-ignore
          interviewRecordId: interviewId as any,
        }
      : "skip"
  );

  if (!interviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg text-gray-300">Loading your feedback...</p>
        </div>
      </div>
    );
  }

  if (!interviewData?.feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <p className="text-2xl text-gray-300 mb-6">No feedback available yet</p>
          <Button onClick={() => router.back()} className="bg-purple-600 hover:bg-purple-700">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const feedback = interviewData.feedback;
  const feedbackObj = typeof feedback === 'string' ? JSON.parse(feedback) : feedback;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const SectionCard = ({ 
    title, 
    icon: Icon, 
    section, 
    children,
    bgColor = "from-blue-500/10 to-blue-600/10",
    borderColor = "border-blue-500/20",
    iconColor = "text-blue-400"
  }: any) => (
    <div className={`border ${borderColor} bg-gradient-to-br ${bgColor} rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-2xl`}>
      <button
        onClick={() => toggleSection(section as keyof typeof expandedSections)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors duration-300"
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${bgColor} border ${borderColor}`}>
            <Icon className={`${iconColor} w-6 h-6`} />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <ChevronDown 
          className={`w-6 h-6 text-gray-400 transition-transform duration-500 ${expandedSections[section as keyof typeof expandedSections] ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ${
          expandedSections[section as keyof typeof expandedSections] ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-6 pb-6 pt-2 border-t border-white/10">
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 sm:p-8">
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.3); }
          50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.6); }
        }

        .animate-slide-up {
          animation: slideInUp 0.6s ease-out;
        }

        .animate-scale-in {
          animation: scaleIn 0.5s ease-out;
        }

        .header-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }

        .animate-list-item {
          animation: slideInUp 0.6s ease-out backwards;
        }

        .animate-list-item:nth-child(1) { animation-delay: 0.1s; }
        .animate-list-item:nth-child(2) { animation-delay: 0.2s; }
        .animate-list-item:nth-child(3) { animation-delay: 0.3s; }
        .animate-list-item:nth-child(4) { animation-delay: 0.4s; }
        .animate-list-item:nth-child(5) { animation-delay: 0.5s; }

        li.list-item {
          display: flex !important;
        }
      `}
      </style>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 animate-slide-up">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 transition-colors duration-300 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-semibold">Back</span>
          </button>
          <div className="header-glow p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-900/40 to-blue-900/40">
            <h1 className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-3">
              Interview Feedback
            </h1>
            <p className="text-gray-300 text-lg">
              {interviewData.jobTitle || "Your Interview"} 
              {feedbackObj?.rating && <span className="ml-3 text-yellow-400 font-semibold">★ {feedbackObj.rating}/10</span>}
            </p>
          </div>
        </div>

        {/* Feedback Sections */}
        <div className="space-y-6 mb-12">
          {/* Overall Assessment */}
          {(feedbackObj?.feedback || feedbackObj?.overallAssessment) && (
            <SectionCard
              title="Overall Assessment"
              icon={Star}
              section="overall"
              bgColor="from-amber-500/10 to-orange-600/10"
              borderColor="border-amber-500/30"
              iconColor="text-amber-400"
            >
              <p className="text-gray-200 leading-relaxed text-lg">
                {feedbackObj.feedback || feedbackObj.overallAssessment}
              </p>
            </SectionCard>
          )}

          {/* Strengths */}
          {feedbackObj?.suggestion && (
            <SectionCard
              title="Key Strengths"
              icon={TrendingUp}
              section="strengths"
              bgColor="from-green-500/10 to-emerald-600/10"
              borderColor="border-green-500/30"
              iconColor="text-green-400"
            >
              {Array.isArray(feedbackObj.suggestion) ? (
                <ul className="space-y-3">
                  {feedbackObj.suggestion.map((item: string, index: number) => (
                    <li key={index} className="animate-list-item flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors duration-300">
                      <span className="text-green-400 font-bold text-xl mt-0.5">✓</span>
                      <span className="text-gray-200">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-200">{feedbackObj.suggestion}</p>
              )}
            </SectionCard>
          )}

          {/* Areas for Improvement */}
          {feedbackObj?.areasForImprovement && (
            <SectionCard
              title="Areas for Improvement"
              icon={Target}
              section="improvements"
              bgColor="from-orange-500/10 to-red-600/10"
              borderColor="border-orange-500/30"
              iconColor="text-orange-400"
            >
              {Array.isArray(feedbackObj.areasForImprovement) ? (
                <ul className="space-y-3">
                  {feedbackObj.areasForImprovement.map((item: string, index: number) => (
                    <li key={index} className="animate-list-item flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors duration-300">
                      <span className="text-orange-400 font-bold text-lg">→</span>
                      <span className="text-gray-200">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-200">{feedbackObj.areasForImprovement}</p>
              )}
            </SectionCard>
          )}

          {/* Recommendations */}
          {feedbackObj?.recommendations && (
            <SectionCard
              title="Recommendations"
              icon={Lightbulb}
              section="recommendations"
              bgColor="from-blue-500/10 to-cyan-600/10"
              borderColor="border-blue-500/30"
              iconColor="text-blue-400"
            >
              {Array.isArray(feedbackObj.recommendations) ? (
                <ul className="space-y-3">
                  {feedbackObj.recommendations.map((item: string, index: number) => (
                    <li key={index} className="animate-list-item flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors duration-300">
                      <span className="text-blue-400 font-bold text-lg">•</span>
                      <span className="text-gray-200">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-200">{feedbackObj.recommendations}</p>
              )}
            </SectionCard>
          )}
        </div>

        {/* Action Buttons */}
        <div className="animate-slide-up flex flex-col sm:flex-row gap-4 pb-8">
          <button
            onClick={() => router.back()}
            className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 bg-gray-700 hover:bg-gray-600 text-white hover:shadow-lg hover:shadow-gray-600/50"
          >
            Go Back
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/50"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
