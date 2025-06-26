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

export function ActivityChart({ data, currency = 'USD' }: ActivityChartProps) {
  console.log('[CHART] ActivityChart received data:', data)
  
  if (!data || data.length === 0) {
    console.log('[CHART] No data provided to ActivityChart')
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No activity data available</p>
      </div>
    )
  }

  const chartData = {
    labels: data.map(d => d.label || new Date(d.date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })),
    datasets: [
      {
        label: 'Daily Cost',
        data: data.map(d => {
          // If no activity, show a minimal bar for visual consistency
          if (d.sessions === 0 && d.cost === 0 && d.tokens === 0) {
            return 0.001; // Very small value to show empty state
          }
          return d.cost;
        }),
        backgroundColor: data.map(d => {
          // Different color for days with no activity
          if (d.sessions === 0 && d.cost === 0 && d.tokens === 0) {
            return 'rgba(156, 163, 175, 0.3)'; // Muted gray
          }
          return 'rgba(99, 102, 241, 0.8)'; // Normal blue
        }),
        borderColor: data.map(d => {
          if (d.sessions === 0 && d.cost === 0 && d.tokens === 0) {
            return 'rgba(156, 163, 175, 0.5)';
          }
          return 'rgb(99, 102, 241)';
        }),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }
    ],
  }

  // Custom plugin for drawing "No sessions" text
  const noSessionsPlugin = {
    id: 'noSessionsLabel',
    afterDatasetsDraw: (chart: any) => {
      const ctx = chart.ctx
      const meta = chart.getDatasetMeta(0)
      const chartArea = chart.chartArea
      
      // Loop through each bar
      meta.data.forEach((bar: any, index: number) => {
        const item = data[index]
        
        // Only draw text on bars with no sessions
        if (item.sessions === 0 && item.cost === 0 && item.tokens === 0) {
          const barRect = bar.getProps(['x', 'y', 'width', 'height'])
          
          // Save the current context
          ctx.save()
          
          // Set up text properties - smaller font size
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)' // Almost white
          ctx.font = 'bold 12px sans-serif' // Smaller font size
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          
          // Position text in the middle of the chart area
          const centerX = barRect.x
          const chartHeight = chartArea.bottom - chartArea.top
          const topY = chartArea.top + (chartHeight * 0.5) // 50% down from the top (20% higher than 70%)
          
          // Rotate the text to be diagonal
          ctx.translate(centerX, topY)
          ctx.rotate(-Math.PI / 4) // -45 degrees for better visibility
          
          // Draw the text
          ctx.fillText('No sessions', 0, 0)
          
          // Restore the context
          ctx.restore()
        }
      })
    }
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const dataIndex = context.dataIndex
            const item = data[dataIndex]
            
            // Handle zero values specially
            if (item.sessions === 0 && item.cost === 0 && item.tokens === 0) {
              return [
                'No sessions today',
                'Cost: $0.00',
                'Tokens: 0'
              ]
            }
            
            return [
              `Cost: ${formatCurrency(item.cost, currency)}`,
              `Tokens: ${item.tokens.toLocaleString()}`,
              `Sessions: ${item.sessions}`
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
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 12,
          },
          callback: function(value: any) {
            // Don't show very small values (our zero-state indicators)
            if (value < 0.01) {
              return '$0.00'
            }
            return formatCurrency(value, currency)
          }
        },
      },
    },
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-48">
        <Bar data={chartData} options={options} plugins={[noSessionsPlugin]} />
      </div>
      
      {/* Data labels under chart - Ensure consistent grid */}
      <div className={`grid gap-1 text-xs ${
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
  )
}