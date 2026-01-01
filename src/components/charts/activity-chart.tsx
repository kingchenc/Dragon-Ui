import React, { memo, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatCurrency } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface ActivityChartProps {
  data: Array<{
    date: string
    cost: number
    tokens: number
    sessions: number
    label?: string
  }>
  currency?: string
}

export const ActivityChart = memo(function ActivityChart({ data, currency = 'USD' }: ActivityChartProps) {
  // Memoize chart data to prevent recalculation
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    return {
      labels: data.map(d => d.label || new Date(d.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })),
      datasets: [
        {
          label: 'Daily Cost',
          data: data.map(d => {
            if (d.sessions === 0 && d.cost === 0 && d.tokens === 0) {
              return 0.001
            }
            return d.cost
          }),
          backgroundColor: data.map(d => {
            if (d.sessions === 0 && d.cost === 0 && d.tokens === 0) {
              return 'rgba(156, 163, 175, 0.3)'
            }
            return 'rgba(99, 102, 241, 0.8)'
          }),
          borderColor: data.map(d => {
            if (d.sessions === 0 && d.cost === 0 && d.tokens === 0) {
              return 'rgba(156, 163, 175, 0.5)'
            }
            return 'rgb(99, 102, 241)'
          }),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        }
      ],
    }
  }, [data])

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No activity data available</p>
      </div>
    )
  }

  // Memoize plugin and options to prevent re-renders
  const noSessionsPlugin = useMemo(() => ({
    id: 'noSessionsLabel',
    afterDatasetsDraw: (chart: any) => {
      const ctx = chart.ctx
      const meta = chart.getDatasetMeta(0)
      const chartArea = chart.chartArea

      meta.data.forEach((bar: any, index: number) => {
        const item = data[index]
        if (item?.sessions === 0 && item?.cost === 0 && item?.tokens === 0) {
          const barRect = bar.getProps(['x', 'y', 'width', 'height'])
          ctx.save()
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.font = 'bold 12px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const centerX = barRect.x
          const chartHeight = chartArea.bottom - chartArea.top
          const topY = chartArea.top + (chartHeight * 0.5)
          ctx.translate(centerX, topY)
          ctx.rotate(-Math.PI / 4)
          ctx.fillText('No sessions', 0, 0)
          ctx.restore()
        }
      })
    }
  }), [data])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const item = data[context.dataIndex]
            if (item?.sessions === 0 && item?.cost === 0 && item?.tokens === 0) {
              return ['No sessions today', 'Cost: $0.00', 'Tokens: 0']
            }
            return [
              `Cost: ${formatCurrency(item?.cost || 0, currency)}`,
              `Tokens: ${(item?.tokens || 0).toLocaleString()}`,
              `Sessions: ${item?.sessions || 0}`
            ]
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(99, 102, 241, 0.8)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgb(156, 163, 175)', font: { size: 12 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: { size: 12 },
          callback: function(value: any) {
            if (value < 0.01) return '$0.00'
            return formatCurrency(value, currency)
          }
        },
      },
    },
  }), [data, currency])

  const plugins = useMemo(() => [noSessionsPlugin], [noSessionsPlugin])

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-48">
        <Bar data={chartData} options={options} plugins={plugins} />
      </div>
      
      {/* Data labels under chart - Only under day bars, exclude Y-axis area */}
      <div className="flex justify-start ml-12 mr-4">
        <div className={`grid gap-1 text-xs flex-1 ${
          data.length === 7 ? 'grid-cols-7' : 
          data.length === 6 ? 'grid-cols-6' : 
          data.length === 5 ? 'grid-cols-5' :
          data.length === 4 ? 'grid-cols-4' :
          data.length === 3 ? 'grid-cols-3' :
          data.length === 2 ? 'grid-cols-2' :
          'grid-cols-1'
        }`}>
          {data.map((day, index) => {
            const hasActivity = day.sessions > 0 || day.cost > 0 || day.tokens > 0
            
            return (
              <div key={index} className={`text-center space-y-1 p-2 rounded ${
                hasActivity ? 'bg-muted/20' : 'bg-muted/10 opacity-60'
              }`}>
                {hasActivity ? (
                  <>
                    <div className="font-semibold text-dragon-primary">
                      {formatCurrency(day.cost, currency)}
                    </div>
                    <div className="text-muted-foreground">
                      {day.tokens.toLocaleString()}T
                    </div>
                    <div className="text-muted-foreground">
                      {day.sessions}S
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-muted-foreground">
                      $0.00
                    </div>
                    <div className="text-muted-foreground text-xs">
                      No sessions
                    </div>
                    <div className="text-muted-foreground text-xs opacity-50">
                      -
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})