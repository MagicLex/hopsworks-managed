import { Box, Card, Flex } from 'tailwind-quartz';

interface CardSkeletonProps {
  rows?: number;
  showIcon?: boolean;
  className?: string;
}

export default function CardSkeleton({ 
  rows = 3, 
  showIcon = true,
  className = ''
}: CardSkeletonProps) {
  return (
    <Card className={`p-6 ${className}`}>
      <Flex direction="column" gap={12}>
        {showIcon && (
          <Flex align="center" gap={12}>
            <Box className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
            <Box className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          </Flex>
        )}
        {Array.from({ length: rows }).map((_, i) => (
          <Box key={i} className="space-y-2">
            <Box className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            <Box className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
          </Box>
        ))}
      </Flex>
    </Card>
  );
}