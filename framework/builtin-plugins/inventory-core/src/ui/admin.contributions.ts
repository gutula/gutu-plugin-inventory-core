import {
  defineAdminNav,
  defineCommand,
  definePage,
  defineWorkspace,
  type AdminContributionRegistry
} from "@platform/admin-contracts";

import { BusinessAdminPage } from "./admin/main.page";

export const adminContributions: Pick<AdminContributionRegistry, "workspaces" | "nav" | "pages" | "commands"> = {
  workspaces: [
    defineWorkspace({
      id: "inventory",
      label: "Inventory",
      icon: "package",
      description: "Warehouse truth, reservations, transfers, and physical reconciliation.",
      permission: "inventory.stock-ledger.read",
      homePath: "/admin/business/inventory",
      quickActions: ["inventory-core.open.control-room"]
    })
  ],
  nav: [
    defineAdminNav({
      workspace: "inventory",
      group: "control-room",
      items: [
        {
          id: "inventory-core.overview",
          label: "Control Room",
          icon: "package",
          to: "/admin/business/inventory",
          permission: "inventory.stock-ledger.read"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "inventory-core.page",
      kind: "dashboard",
      route: "/admin/business/inventory",
      label: "Inventory Control Room",
      workspace: "inventory",
      group: "control-room",
      permission: "inventory.stock-ledger.read",
      component: BusinessAdminPage
    })
  ],
  commands: [
    defineCommand({
      id: "inventory-core.open.control-room",
      label: "Open Inventory Core",
      permission: "inventory.stock-ledger.read",
      href: "/admin/business/inventory",
      keywords: ["inventory core","inventory","business"]
    })
  ]
};
