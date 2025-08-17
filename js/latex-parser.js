// LaTeX Parser for processing quiz content
class LatexParser {
    constructor() {
        this.sections = [];
        this.questions = [];
    }

    parseLatexFile(content) {
        this.sections = this.parseSections(content);
        
        if (this.sections.length > 0) {
            return {
                type: 'sections',
                data: this.sections
            };
        } else {
            this.questions = this.parseQuestionsFromContent(content);
            return {
                type: 'questions',
                data: this.questions
            };
        }
    }

    parseSections(content) {
        const sections = [];
        const sectionRegex = /\\section\*?\{([^}]+)\}/g;
        const sectionMatches = [...content.matchAll(sectionRegex)];
        
        console.log(`Found ${sectionMatches.length} sections`);
        
        if (sectionMatches.length === 0) {
            return [];
        }
        
        sectionMatches.forEach((match, index) => {
            const sectionTitle = match[1];
            const sectionStart = match.index;
            
            // Add content before first section as introduction if it exists
            if (index === 0 && sectionStart > 0) {
                const introContent = content.substring(0, sectionStart);
                const introQuestions = this.parseQuestionsFromContent(introContent);
                if (introQuestions.length > 0) {
                    sections.push({
                        title: 'Introduction',
                        questions: introQuestions,
                        isIntro: true
                    });
                }
            }
            
            const nextSectionStart = index < sectionMatches.length - 1 
                ? sectionMatches[index + 1].index 
                : content.length;
            
            const sectionContent = content.substring(sectionStart, nextSectionStart);
            const questions = this.parseQuestionsFromContent(sectionContent);
            
            sections.push({
                title: sectionTitle,
                questions: questions,
                content: sectionContent
            });
        });
        
        return sections;
    }

    parseQuestionsFromContent(content) {
        const questions = [];
        const questionsMatch = content.match(/\\begin{questions}(.*?)\\end{questions}/s);
        
        if (!questionsMatch) {
            return questions;
        }

        const questionsContent = questionsMatch[1];
        const questionBlocks = questionsContent.split(/\\question\s+/).filter(block => block.trim());
        
        questionBlocks.forEach((block, index) => {
            const question = { 
                id: index + 1, 
                text: '', 
                parts: [] 
            };
            
            const partsMatch = block.match(/(.*?)\\begin{parts}(.*?)\\end{parts}/s);
            
            if (partsMatch) {
                question.text = partsMatch[1].trim();
                const partsContent = partsMatch[2];
                
                const parts = partsContent.split(/\\part\s+/).filter(part => part.trim());
                parts.forEach((partText, partIndex) => {
                    question.parts.push({
                        id: partIndex + 1,
                        text: partText.trim()
                    });
                });
            } else {
                question.text = block.trim();
                question.parts.push({
                    id: 1,
                    text: ''
                });
            }
            
            questions.push(question);
        });

        return questions;
    }

    processLatexText(text) {
        return text
            .replace(/\\vspace\{[^}]*\}/g, '')
            .replace(/\\textbf{([^}]*)}/g, '<strong>$1</strong>')
            .replace(/\\textit{([^}]*)}/g, '<em>$1</em>')
            .replace(/\\emph{([^}]*)}/g, '<em>$1</em>')
            .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, (match, url, label) => {
                // Handle different types of links
                if (/\.(mp4|webm|ogg)$/i.test(url)) {
                    return `
                        <video controls width="640">
                            <source src="${url}" type="video/${url.split('.').pop()}">
                            Your browser does not support the video tag.
                        </video>
                    `;
                }

                const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                if (ytMatch) {
                    const videoId = ytMatch[1];
                    return `
                        <iframe width="640" height="360"
                            src="https://www.youtube.com/embed/${videoId}"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    `;
                }

                const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                if (vimeoMatch) {
                    const videoId = vimeoMatch[1];
                    return `
                        <iframe src="https://player.vimeo.com/video/${videoId}"
                            width="640" height="360"
                            frameborder="0"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    `;
                }

                return `<a href="${url}" target="_blank">${label}</a>`;
            });
    }

    renderMath() {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch((err) => console.log('MathJax error:', err.message));
        }
    }

    renderMathForSection(sectionIndex) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            const sectionElement = document.querySelector(`[data-section="${sectionIndex}"]`);
            if (sectionElement) {
                window.MathJax.typesetPromise([sectionElement]).catch((err) => console.log('MathJax error:', err.message));
            }
        }
    }

    getSections() {
        return this.sections;
    }

    getQuestions() {
        return this.questions;
    }

    clear() {
        this.sections = [];
        this.questions = [];
    }
}