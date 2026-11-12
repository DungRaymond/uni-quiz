import katex from 'katex';

export default function RichText({ text }: { text: string }) {
  return <>{text.split(/(\$[^$\n]+\$|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      // KaTeX escapes input, trust:false blocks unsafe commands and external resources.
      const html = katex.renderToString(part.slice(1, -1), { throwOnError: false, trust: false, strict: 'ignore', output: 'htmlAndMathml' });
      return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  })}</>;
}
