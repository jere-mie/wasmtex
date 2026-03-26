import * as React from "react"
import { GripVertical } from "lucide-react"
import { Group, Panel, Separator, type GroupProps, type PanelProps } from "react-resizable-panels"
import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: GroupProps) => (
  <Group
    className={cn("flex h-full w-full", className)}
    {...props}
  />
)

const ResizablePanel = (props: PanelProps) => <Panel {...props} />

const ResizableHandle = ({
  orientation = "horizontal",
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  orientation?: "horizontal" | "vertical"
  withHandle?: boolean
}) => (
  <Separator
    className={cn(
      "group relative z-10 flex shrink-0 items-center justify-center bg-ink-700/90 transition-colors hover:bg-amber-glow/40",
      orientation === "horizontal" ? "w-px h-full cursor-col-resize" : "h-px w-full cursor-row-resize",
      className
    )}
    style={{
      width: orientation === "horizontal" ? "1px" : "100%",
      height: orientation === "horizontal" ? "100%" : "1px",
      ...props.style,
    }}
    {...props}
  >
    {withHandle !== false && (
      <div
        className={cn(
          "pointer-events-none z-10 flex items-center justify-center rounded-sm border border-ink-600 bg-ink-800 shadow-[0_0_0_1px_rgba(8,6,10,0.55)] transition-colors group-hover:border-amber-glow/60 group-hover:bg-ink-750",
          orientation === "horizontal" ? "h-5 w-3" : "h-3 w-5"
        )}
      >
        <GripVertical className={cn("text-ink-400", orientation === "horizontal" ? "h-3 w-3" : "h-3 w-3 rotate-90")} />
      </div>
    )}
  </Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
