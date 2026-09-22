export function setFieldPhrases(target: Element, text: string): void {
  const segments = text.split(/(\s+[/·]\s+|\n)/);
  target.replaceChildren(...segments.map((segment, index) => {
    if (index % 2 === 1) return document.createTextNode(segment);
    const phrase = document.createElement("span");
    phrase.className = "field-phrase";
    phrase.textContent = segment;
    return phrase;
  }));
}
