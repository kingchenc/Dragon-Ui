import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { formatCurrency } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface DailyFinancialChartProps {
  data: Array<{
    date: string
    totalCost: number
    money: number
    runningTotal: number
    cumulativeMoney: number
    sessionCount: number
    formattedDate: string
  }>
  currency: string
}

export function DailyFinancialChart({ data, currency }: DailyFinancialChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No financial data available
      </div>
    )
  }

  // Calculate totals for display
  const totalSpend = data.reduce((sum, day) => sum + day.money, 0)
  const finalRunningTotal = data.length > 0 ? data[data.length - 1].cumulativeMoney : 0

  const chartData = {
    labels: data.map(day => day.formattedDate),
    datasets: [
      {
        label: 'Daily Spend',
        data: data.map(day => day.money),
        borderColor: '#7C3AED', // Dragon primary purple
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4, // Curved lines
        pointBackgroundColor: '#7C3AED',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#F59E0B', // Dragon gold
        pointHoverBorderColor: '#FFFFFF',
        pointHoverBorderWidth: 3,
        yAxisID: 'y',
      },
      {
        label: 'Running Total',
        data: data.map(day => day.cumulativeMoney),
        borderColor: '#F59E0B', // Dragon gold
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4, // Curved lines
        pointBackgroundColor: '#F59E0B',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#EF4444', // Dragon flame red
        pointHoverBorderColor: '#FFFFFF',
        pointHoverBorderWidth: 3,
        yAxisID: 'y1',
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#94A3B8',
          font: {
            size: 12
          },
          usePointStyle: true,
          pointStyle: 'line',
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#F1F5F9',
        bodyColor: '#F1F5F9',
        borderColor: '#7C3AED',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex
            return data[index].date
          },
          label: (context: any) => {
            const index = context.dataIndex
            const day = data[index]
            const datasetLabel = context.dataset.label
            
            if (datasetLabel === 'Daily Spend') {
              return [
                `Daily: ${formatCurrency(day.money, currency)}`,
                `Sessions: ${day.sessionCount}`
              ]
            } else {
              return `Total: ${formatCurrency(day.cumulativeMoney, currency)}`
            }
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 11
          },
          maxRotation: 45,
        },
        border: {
          display: false
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        grid: {
          color: 'rgba(124, 58, 237, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: '#7C3AED',
          font: {
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(value, currency)
          }
        },
        border: {
          display: false
        },
        title: {
          display: true,
          text: 'Daily Spend',
          color: '#7C3AED',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
          color: 'rgba(245, 158, 11, 0.1)',
        },
        ticks: {
          color: '#F59E0B',
          font: {
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(value, currency)
          }
        },
        border: {
          display: false
        },
        title: {
          display: true,
          text: 'Running Total',
          color: '#F59E0B',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }
    },
    elements: {
      point: {
        hoverBackgroundColor: '#F59E0B',
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Chart Summary */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Last {data.length} days • Dual financial view
        </div>
        <div className="flex space-x-8">
          <div className="text-right">
            <div className="text-lg font-bold text-dragon-primary">
              {formatCurrency(totalSpend, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              Period Total
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-dragon-gold">
              {formatCurrency(finalRunningTotal, currency)}
            </div>
            <div className="text-sm text-muted-foreground">
              Running Total
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Chart */}
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}