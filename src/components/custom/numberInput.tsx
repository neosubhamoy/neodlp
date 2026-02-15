import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface NumberInputProps
    extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
    value?: number
    defaultValue?: number
    min?: number
    max?: number
    step?: number
    onChange?: (value: number) => void
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue = 0,
      min = -Infinity,
      max = Infinity,
      step = 1,
      onChange,
      disabled,
      readOnly,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const isControlled = controlledValue !== undefined
    const currentValue = isControlled ? controlledValue : internalValue

    const updateValue = (newValue: number) => {
      const clamped = Math.min(max, Math.max(min, newValue))
      if (!isControlled) {
        setInternalValue(clamped)
      }
      onChange?.(clamped)
    }

    const handleIncrement = () => {
      if (!disabled && !readOnly) {
        updateValue(currentValue + step)
      }
    }

    const handleDecrement = () => {
      if (!disabled && !readOnly) {
        updateValue(currentValue - step)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(e.target.value)
      if (!isNaN(parsed)) {
        updateValue(parsed)
      } else if (e.target.value === "" || e.target.value === "-") {
        if (!isControlled) {
          setInternalValue(0)
        }
      }
    }

    return (
      <div className={cn("relative flex items-center", className)}>
        <Input
          type="number"
          ref={ref}
          value={currentValue}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          className="pr-16 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] focus-visible:ring-0"
          {...props}
        />
        <div className="absolute right-0 flex h-full items-center">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled || readOnly || currentValue <= min}
            className="flex h-full items-center justify-center px-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 transition-colors border-x"
            aria-label="Decrement"
            tabIndex={-1}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled || readOnly || currentValue >= max}
            className="flex h-full items-center justify-center px-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 transition-colors rounded-r-md"
            aria-label="Increment"
            tabIndex={-1}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }
)
NumberInput.displayName = "NumberInput"

export { NumberInput }
