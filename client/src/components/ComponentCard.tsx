import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface PropInfo {
  name: string;
  type: string;
  default?: string;
  description: string;
}

interface ComponentCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  props: PropInfo[];
  features?: string[];
}

export function ComponentCard({
  name,
  description,
  icon: Icon,
  props,
  features,
}: ComponentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow duration-300 border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl font-semibold">{name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {features && features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {features.map((feature) => (
                <Badge key={feature} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Props</h4>
            <div className="space-y-2">
              {props.map((prop) => (
                <div
                  key={prop.name}
                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-semibold text-primary">
                      {prop.name}
                    </code>
                    <Badge variant="outline" className="text-xs font-mono">
                      {prop.type}
                    </Badge>
                    {prop.default && (
                      <span className="text-xs text-muted-foreground">
                        = {prop.default}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {prop.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
