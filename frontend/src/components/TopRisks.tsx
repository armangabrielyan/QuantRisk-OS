import { Panel } from './ui'

export function TopRisks({ ov }: { ov: any }) {
  return (
    <Panel title={ov.topRisksTitle}>
      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2 text-red-400">
          <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
          <span>{ov.topRisksDesc1}</span>
        </li>
        <li className="flex items-start gap-2 text-amber-400">
          <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-amber-500" />
          <span>{ov.topRisksDesc2}</span>
        </li>
        <li className="flex items-start gap-2 text-amber-400">
          <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-amber-500" />
          <span>{ov.topRisksDesc3}</span>
        </li>
      </ul>
    </Panel>
  )
}
