import { motion } from "framer-motion";

export function ArchitectureDiagram() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  };

  return (
    <motion.div
      className="relative p-8 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-border overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(99, 102, 241, 0.15) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative">
        {/* Title */}
        <h3 className="text-lg font-semibold text-center mb-8 text-foreground">
          Component Architecture
        </h3>

        {/* Diagram */}
        <div className="flex flex-col items-center gap-4">
          {/* PdfReaderView */}
          <motion.div
            variants={itemVariants}
            className="w-full max-w-md p-4 bg-white rounded-xl border-2 border-primary shadow-sm"
          >
            <div className="text-center font-semibold text-primary">
              PdfReaderView
            </div>
            <div className="text-xs text-center text-muted-foreground mt-1">
              Main container component
            </div>
          </motion.div>

          {/* Connection line */}
          <motion.div
            variants={itemVariants}
            className="w-0.5 h-6 bg-gradient-to-b from-primary to-primary/50"
          />

          {/* Second level */}
          <div className="flex flex-wrap justify-center gap-4 w-full">
            <motion.div
              variants={itemVariants}
              className="flex-1 min-w-[140px] max-w-[180px] p-3 bg-white rounded-lg border border-indigo-200 shadow-sm"
            >
              <div className="text-sm font-medium text-indigo-600 text-center">
                PageHeader
              </div>
              <div className="text-xs text-center text-muted-foreground mt-1">
                Controls & settings
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex-1 min-w-[140px] max-w-[180px] p-3 bg-white rounded-lg border border-cyan-200 shadow-sm"
            >
              <div className="text-sm font-medium text-cyan-600 text-center">
                Document (PDF)
              </div>
              <div className="text-xs text-center text-muted-foreground mt-1">
                PDF rendering
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex-1 min-w-[140px] max-w-[180px] p-3 bg-white rounded-lg border border-pink-200 shadow-sm"
            >
              <div className="text-sm font-medium text-pink-600 text-center">
                DanmakuInput
              </div>
              <div className="text-xs text-center text-muted-foreground mt-1">
                Message input
              </div>
            </motion.div>
          </div>

          {/* Connection lines */}
          <motion.div variants={itemVariants} className="flex gap-8">
            <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-300 to-indigo-100" />
            <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-300 to-cyan-100" />
          </motion.div>

          {/* Third level */}
          <div className="flex flex-wrap justify-center gap-4 w-full">
            <motion.div
              variants={itemVariants}
              className="flex-1 min-w-[140px] max-w-[180px] p-3 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200"
            >
              <div className="text-sm font-medium text-indigo-700 text-center">
                DanmakuControl
              </div>
              <div className="text-xs text-center text-indigo-500 mt-1">
                Settings panel
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex-1 min-w-[140px] max-w-[180px] p-3 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg border border-cyan-200"
            >
              <div className="text-sm font-medium text-cyan-700 text-center">
                DanmakuContainer
              </div>
              <div className="text-xs text-center text-cyan-500 mt-1">
                Animation manager
              </div>
            </motion.div>
          </div>

          {/* Connection line */}
          <motion.div
            variants={itemVariants}
            className="w-0.5 h-6 bg-gradient-to-b from-cyan-300 to-green-300"
          />

          {/* Fourth level */}
          <motion.div
            variants={itemVariants}
            className="p-3 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg border border-green-200"
          >
            <div className="text-sm font-medium text-green-700 text-center">
              DanmakuItem[]
            </div>
            <div className="text-xs text-center text-green-500 mt-1">
              Individual messages
            </div>
          </motion.div>
        </div>

        {/* Legend */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-muted-foreground">Main Component</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-indigo-400" />
              <span className="text-muted-foreground">Header Components</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-cyan-400" />
              <span className="text-muted-foreground">Danmaku Core</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-400" />
              <span className="text-muted-foreground">Danmaku Items</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
