'use client'
import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

interface HoverCardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  accentColor?: string
}

export default function HoverCard({ children, className, style, accentColor }: HoverCardProps) {
  const glowColor = accentColor
    ? accentColor + '1a'
    : 'rgba(23,162,184,0.10)'

  return (
    <motion.div
      whileHover={{
        y: -3,
        boxShadow: `0 8px 28px ${glowColor}`,
        borderColor: accentColor ? accentColor + '40' : 'rgba(23,162,184,0.25)',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}
