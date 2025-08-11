import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group",
          icon: "group-data-[type=error]:!text-red-500 group-data-[type=success]:!text-green-500 group-data-[type=warning]:!text-amber-500 group-data-[type=info]:!text-sky-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
