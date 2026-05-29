"use client"

import { useState, useEffect } from "react"
import { addMusic, useStatus } from "@/hooks/useApi"
import { Button } from "@/components/ui/button"
import { Link2, Loader2, CheckCircle2, AlertCircle, Music } from "lucide-react"

export default function AddMusicPage() {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "polling" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  
  const { status: libraryStatus, mutate: refreshStatus } = useStatus()
  const [initialTrackCount, setInitialTrackCount] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setStatus("submitting")
    setErrorMsg("")
    
    // Capture the initial track count before submitting
    if (libraryStatus) {
      setInitialTrackCount(libraryStatus.trackCount)
    }

    try {
      await addMusic(url)
      setStatus("polling")
      setUrl("")
    } catch (err: any) {
      setStatus("error")
      setErrorMsg(err.message || "Failed to add music. Make sure your downloader worker is deployed and the URL is correct in .env.local.")
    }
  }

  // Polling logic
  useEffect(() => {
    if (status === "polling") {
      const interval = setInterval(async () => {
        const newData = await refreshStatus()
        
        // If track count increased, we assume it finished
        if (newData && initialTrackCount !== null && newData.trackCount > initialTrackCount) {
          setStatus("success")
          clearInterval(interval)
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [status, initialTrackCount, refreshStatus])

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex items-center justify-center p-6 md:p-8">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full mix-blend-screen filter blur-[120px] opacity-60 animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[120px] opacity-60 animate-pulse delay-1000 pointer-events-none" />
      
      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2 ring-1 ring-primary/20 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]">
            <Music className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            Expand Your Library
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            Paste a YouTube or Spotify playlist link below, and MuSync will magically fetch it in the highest quality available.
          </p>
        </div>

        <div className="bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl ring-1 ring-white/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-white/80 ml-1 tracking-wide uppercase text-xs">Media URL</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-blue-500/50 rounded-xl blur-md opacity-0 group-focus-within:opacity-30 transition-opacity duration-500" />
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors z-10" size={22} />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  required
                  disabled={status === "submitting" || status === "polling"}
                  className="relative w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white/10 disabled:opacity-50 transition-all text-lg shadow-inner z-10"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={!url || status === "submitting" || status === "polling"}
              className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-[0_0_40px_-10px_rgba(34,197,94,0.5)] hover:shadow-[0_0_60px_-10px_rgba(34,197,94,0.7)] transition-all duration-300 disabled:shadow-none disabled:bg-primary/50 overflow-hidden relative group"
            >
              {/* Button inner shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
              
              <span className="relative z-10 flex items-center justify-center">
                {status === "submitting" ? (
                  <><Loader2 className="mr-3 animate-spin" size={22} /> Submitting Request...</>
                ) : status === "polling" ? (
                  <><Loader2 className="mr-3 animate-spin" size={22} /> Downloading Tracks...</>
                ) : (
                  "Add to Library"
                )}
              </span>
            </Button>
          </form>

          {/* Status Messages */}
          <div className="mt-8">
            {status === "success" && (
              <div className="flex items-start gap-4 p-5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-2xl animate-in fade-in slide-in-from-bottom-4 shadow-lg shadow-green-500/5">
                <CheckCircle2 className="mt-0.5 shrink-0" size={24} />
                <div>
                  <p className="font-bold text-lg mb-1">Successfully added!</p>
                  <p className="text-sm opacity-90 leading-relaxed">The new tracks have been securely stored in R2 and are now available in your library.</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-start gap-4 p-5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-bottom-4 shadow-lg shadow-red-500/5">
                <AlertCircle className="mt-0.5 shrink-0" size={24} />
                <div>
                  <p className="font-bold text-lg mb-1">Upload Failed</p>
                  <p className="text-sm opacity-90 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {status === "polling" && (
              <div className="flex items-center justify-center p-6 text-white/50 animate-pulse border border-white/5 rounded-2xl bg-white/5">
                <p className="text-sm text-center">Processing in the background...<br/>You can safely navigate away from this page.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
