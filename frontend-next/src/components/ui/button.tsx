import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utlis"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Define the props interface for the Button component
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, // Include standard button attributes (like onClick, type, disabled)
    VariantProps<typeof buttonVariants> { // Include variant props defined by cva
  asChild?: boolean // Prop to render the child component instead of a button element
}

// Define the Button component using React.forwardRef
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  // forwardRef takes the component type (HTMLButtonElement) and props type (ButtonProps)
  // It receives props and the ref as arguments
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Determine the component to render:
    // If asChild is true, use Radix UI's Slot component which merges props onto the immediate child.
    // Otherwise, render a standard HTML <button> element.
    const Comp = asChild ? Slot : "button"
    return (
      // Render the chosen component (Slot or "button")
      <Comp
        // Apply classes using cn utility:
        // - buttonVariants generates classes based on variant/size props.
        // - className allows passing additional custom classes.
        className={cn(buttonVariants({ variant, size, className }))}
        // Forward the ref to the underlying DOM element (button or Slot's child)
        ref={ref}
        // Spread any remaining props (like onClick, type, disabled, children)
        {...props}
      />
    )
  }
)

// Set the display name for the component (used in React DevTools)
Button.displayName = "Button"

// Export the Button component and the variants definition
export { Button, buttonVariants }
