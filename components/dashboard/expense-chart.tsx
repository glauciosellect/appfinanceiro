'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { CategorySummary } from '@/types'

interface ExpenseChartProps {
  data: CategorySummary[]
  loading?: boolean
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3">
        <p className="font-semibold text-gray-900 text-sm">{item.category}</p>
        <p className="text-gray-600 text-sm">{formatCurrency(item.amount)}</p>
        <p className="text-gray-400 text-xs">{item.percentage.toFixed(1)}%</p>
      </div>
    )
  }
  return null
}

function CustomLegend({ payload }: any) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
      {payload?.map((entry: any) => (
        <li key={entry.value} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

export function ExpenseChart({ data, loading }: ExpenseChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="h-48 w-48 rounded-full bg-gray-100 animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-4xl mb-2">📊</p>
            <p className="text-sm text-gray-500">Nenhuma despesa no período</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
