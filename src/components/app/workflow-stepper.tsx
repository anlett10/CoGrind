import { Check, Circle } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function WorkflowStepper({
  steps,
  orientation = "horizontal",
  className,
}: WorkflowStepperProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={cn(
        "flex",
        isHorizontal ? "flex-col sm:flex-row gap-4" : "flex-col gap-6",
        className,
      )}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === "completed";
        const isCurrent = step.status === "current";

        return (
          <div
            key={step.id}
            className={cn(
              "flex",
              isHorizontal
                ? "flex-1 flex-col items-center"
                : "flex-row items-start",
            )}
          >
            {/* Step content */}
            <div
              className={cn(
                "flex",
                isHorizontal
                  ? "flex-col items-center text-center"
                  : "flex-row items-start gap-4 w-full",
              )}
            >
              {/* Icon */}
              <div className="flex items-center justify-center relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCompleted &&
                      "bg-gradient-to-br from-green-500 to-green-600 border-green-600 shadow-lg shadow-green-500/30",
                    isCurrent &&
                      "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600 shadow-lg shadow-blue-500/30 animate-pulse-soft",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-white" strokeWidth={3} />
                  ) : (
                    <Circle
                      className={cn(
                        "h-5 w-5",
                        isCurrent
                          ? "text-white"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                      strokeWidth={2}
                    />
                  )}
                </motion.div>

                {/* Animated ring for current step */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-blue-500"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: "loop",
                    }}
                  />
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute",
                    isHorizontal
                      ? "hidden sm:block left-1/2 top-5 h-0.5 w-full -translate-y-1/2"
                      : "left-5 top-10 h-full w-0.5",
                    isCompleted
                      ? "bg-gradient-to-r from-green-500 to-green-600"
                      : "bg-slate-200 dark:bg-slate-700",
                  )}
                  style={
                    isHorizontal
                      ? { width: "calc(100% - 2.5rem)" }
                      : { height: "calc(100% - 2.5rem)" }
                  }
                >
                  {/* Animated progress */}
                  {isCurrent && (
                    <motion.div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600",
                        isHorizontal ? "h-full" : "w-full",
                      )}
                      initial={
                        isHorizontal ? { width: "0%" } : { height: "0%" }
                      }
                      animate={
                        isHorizontal ? { width: "100%" } : { height: "100%" }
                      }
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                </div>
              )}

              {/* Text content */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.2, duration: 0.3 }}
                className={cn(
                  "flex-1",
                  isHorizontal ? "mt-4" : "mt-0 pt-1",
                )}
              >
                <h3
                  className={cn(
                    "font-semibold text-sm sm:text-base transition-colors duration-300",
                    isCompleted &&
                      "text-green-700 dark:text-green-400",
                    isCurrent &&
                      "text-blue-700 dark:text-blue-400",
                    !isCompleted &&
                      !isCurrent &&
                      "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cn(
                    "mt-1 text-xs sm:text-sm transition-colors duration-300",
                    isCompleted || isCurrent
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {step.description}
                </p>
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

