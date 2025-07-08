import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DragonBadge } from '@/components/ui/badge'
import { Download, X, AlertTriangle, Zap } from 'lucide-react'

interface UpdatePopupProps {
  isOpen: boolean
  onClose: () => void
  currentVersion: string
  latestVersion: string
  onUpdate: () => Promise<void>
}

export function UpdatePopup({ isOpen, onClose, currentVersion, latestVersion, onUpdate }: UpdatePopupProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      await onUpdate()
    } catch (error) {
      console.error('[UPDATE] Update failed:', error)
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-dragon-primary" />
            <span>Update Available</span>
          </DialogTitle>
          <DialogDescription>
            A new version of Dragon UI is available with improvements and bug fixes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Version Comparison */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Current Version</p>
              <DragonBadge variant="outline" className="mt-1">
                v{currentVersion}
              </DragonBadge>
            </div>
            
            <div className="flex items-center">
              <div className="h-px w-8 bg-gradient-to-r from-dragon-primary to-dragon-secondary"></div>
              <Zap className="h-4 w-4 mx-2 text-dragon-accent" />
              <div className="h-px w-8 bg-gradient-to-r from-dragon-secondary to-dragon-primary"></div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Latest Version</p>
              <DragonBadge variant="dragon" className="mt-1 animate-pulse">
                v{latestVersion}
              </DragonBadge>
            </div>
          </div>

          {/* Update Warning */}
          <div className="flex items-start space-x-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-300">
                Automatic Update
              </p>
              <p className="text-yellow-600 dark:text-yellow-400">
                The app will close and restart automatically. Save any work before proceeding.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
            className="flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Later</span>
          </Button>
          
          <Button
            variant="dragon"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex items-center space-x-2"
          >
            <Download className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating...' : 'Update Now'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}