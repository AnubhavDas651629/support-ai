"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOrganization } from "@/context/OrganizationContext";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { TicketInboxView } from "@/components/tickets/TicketInboxView";
import { KnowledgeBaseManagerView } from "@/components/knowledge/KnowledgeBaseManagerView";
import { AssistantSettingsView } from "@/components/assistant/AssistantSettingsView";
import { DeveloperPortalView } from "@/components/developer/DeveloperPortalView";
import { UsageAnalyticsView } from "@/components/billing/UsageAnalyticsView";
import { LiveConversationsView } from "@/components/conversations/LiveConversationsView";
import { WorkspaceSettingsView } from "@/components/settings/WorkspaceSettingsView";
import { LiveAiTestDrawer } from "@/components/dashboard/LiveAiTestDrawer";
import { CreateTicketModal } from "@/components/dashboard/CreateTicketModal";
import { CommandPaletteModal } from "@/components/dashboard/CommandPaletteModal";
import { EmbedScriptModal } from "@/components/dashboard/EmbedScriptModal";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { currentOrg, isLoading: isOrgLoading } = useOrganization();

  const [activeTab, setActiveTab] = useState("overview");
  const [isLiveTesterOpen, setIsLiveTesterOpen] = useState(false);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);

  // Keyboard shortcut listener for Command Palette (⌘K or ⌘F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "f")) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auth guard. AuthContext restores the session from localStorage on mount, so
  // wait for isAuthLoading to settle before deciding — redirecting earlier would
  // bounce authenticated users on every refresh.
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?next=/dashboard");
    }
  }, [isAuthLoading, user, router]);

  const getTabTitle = () => {
    switch (activeTab) {
      case "tickets":
        return "Escalated Tickets & Helpdesk";
      case "conversations":
        return "Live Widget Conversations";
      case "knowledge":
        return "Knowledge Base & Vector Store";
      case "assistant":
        return "AI Assistant Studio & Widget";
      case "developer":
        return "Developer Hub & API Gateway";
      case "analytics":
        return "Usage, Quotas & Subscription Billing";
      case "organization":
        return "Organization & Team Management";
      case "settings":
        return "Workspace Organization & Team Settings";
      default:
        return "Command Center";
    }
  };

  const handleCommandSelect = (key: string) => {
    if (key === "live_test") setIsLiveTesterOpen(true);
    else if (key === "new_ticket") setIsNewTicketOpen(true);
    else if (key === "embed_code") setIsEmbedModalOpen(true);
    else if (key === "upload_doc") setActiveTab("knowledge");
    else if (key === "webhooks" || key === "api_keys") setActiveTab("developer");
  };

  // While the session resolves, and for the frame between deciding the visitor
  // is unauthenticated and the redirect landing, show a spinner rather than the
  // dashboard — otherwise protected content flashes on screen.
  if (isAuthLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="sr-only">Loading your workspace…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-slate-950">
      {/* Permanent Left Sidebar Navigation */}
      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpgrade={() => setIsUpgradeOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <DashboardHeader
          title={getTabTitle()}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenNewTicket={() => setIsNewTicketOpen(true)}
          onOpenLiveTester={() => setIsLiveTesterOpen(true)}
        />

        {/* Dynamic Content Body */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto dark:bg-slate-950">
          {activeTab === "tickets" ? (
            <TicketInboxView />
          ) : activeTab === "conversations" ? (
            <LiveConversationsView />
          ) : activeTab === "knowledge" ? (
            <KnowledgeBaseManagerView />
          ) : activeTab === "assistant" ? (
            <AssistantSettingsView />
          ) : activeTab === "developer" ? (
            <DeveloperPortalView />
          ) : activeTab === "analytics" ? (
            <UsageAnalyticsView />
          ) : activeTab === "settings" || activeTab === "organization" ? (
            <WorkspaceSettingsView />
          ) : (
            <DashboardOverview
              onOpenLiveTester={() => setIsLiveTesterOpen(true)}
              onOpenNewTicket={() => setIsNewTicketOpen(true)}
              onOpenEmbedModal={() => setIsEmbedModalOpen(true)}
              onNavigateToTickets={() => setActiveTab("tickets")}
              onNavigateToKnowledge={() => setActiveTab("knowledge")}
              onNavigateToDeveloper={() => setActiveTab("developer")}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Slide-over Live AI Assistant Testing Drawer */}
      <LiveAiTestDrawer
        isOpen={isLiveTesterOpen}
        onClose={() => setIsLiveTesterOpen(false)}
      />

      {/* Create Manual Ticket Modal */}
      <CreateTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onCreated={(newTicket) => {
          alert(`Escalation Ticket "${newTicket.subject}" created successfully!`);
        }}
      />

      {/* Global Command Palette (⌘K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={handleCommandSelect}
      />

      {/* HTML Embed Script Snippet Modal */}
      <EmbedScriptModal
        isOpen={isEmbedModalOpen}
        onClose={() => setIsEmbedModalOpen(false)}
      />

      {/* Plan Upgrade & Billing Modal */}
      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
      />
    </div>
  );
}
