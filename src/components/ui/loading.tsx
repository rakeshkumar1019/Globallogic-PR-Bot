import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}

export function Loading({ className, size = "md", text }: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div className={cn("flex flex-col items-center justify-center space-y-3", className)}>
      <div className="relative">
        <div 
          className={cn(
            "animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400",
            sizeClasses[size]
          )}
        />
        <div 
          className={cn(
            "absolute inset-0 animate-ping rounded-full border-4 border-blue-400 opacity-20",
            sizeClasses[size]
          )}
        />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({ lines = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
} 